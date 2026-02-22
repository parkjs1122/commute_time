import { RealtimeTransitService } from "@/services/realtime-transit";
import { IntercityBusService } from "@/services/intercity-bus-service";
import { RouteService } from "@/services/route-service";
import { prisma } from "@/lib/prisma";
import type { ETAResult, LegArrivalInfo, DashboardResponse, SavedRouteWithLegs, RouteType } from "@/types";
import { isOffHours } from "@/lib/time-utils";
import type { RouteLeg } from "@prisma/client";

/** 평균 배차 간격 (초) */
const AVERAGE_HEADWAY = {
  bus: 600, // 10분
  subway: 300, // 5분
} as const;

/** getAllTransitArrivals 반환 타입 (단일 leg 결과) */
type CityArrivalEntry = {
  type: "bus" | "subway";
  arrivals: import("@/types").ArrivalInfo[];
  startStation?: string;
  endStation?: string;
};

/** 시외버스 출발 정보 */
type IntercityDeparture = { departureTime: string; waitMinutes: number };

/**
 * Leg이 시외/고속버스 구간인지 판별합니다.
 * legSubType이 설정된 경우 우선, 아닌 경우 런타임 휴리스틱 적용.
 */
function isIntercityBusLeg(
  leg: { type: string; legSubType?: string | null; startStationId?: string | null },
  routeSource?: string | null
): boolean {
  // 명시적으로 설정된 경우
  if (leg.legSubType === "intercity_bus" || leg.legSubType === "express_bus") {
    return true;
  }
  // 하위호환: legSubType 없는 기존 시외 경로 감지
  if (
    routeSource === "inter_local" &&
    leg.type === "bus" &&
    !leg.startStationId
  ) {
    return true;
  }
  return false;
}

/**
 * 시내 대중교통 leg의 중복 제거 키를 생성합니다.
 * - 버스: `bus:{startStationId}:{sortedLineNames}`
 * - 지하철: `subway:{startStation}|{endStation}`
 */
function buildCityLegKey(leg: {
  type: string;
  startStationId?: string | null;
  startStation?: string | null;
  endStation?: string | null;
  lineNames?: string[];
}): string {
  if (leg.type === "bus") {
    const sortedLines = [...(leg.lineNames ?? [])].sort().join(",");
    return `bus:${leg.startStationId ?? ""}:${sortedLines}`;
  }
  if (leg.type === "subway") {
    return `subway:${leg.startStation ?? ""}|${leg.endStation ?? ""}`;
  }
  return "";
}

/**
 * 시외버스 leg의 중복 제거 키를 생성합니다.
 * `{startStation}|{endStation}`
 */
function buildIntercityLegKey(leg: {
  startStation?: string | null;
  endStation?: string | null;
}): string {
  return `${leg.startStation ?? ""}|${leg.endStation ?? ""}`;
}

/**
 * ETA 계산 엔진
 *
 * 저장된 경로에 대해 실시간 도착 정보를 조회하고,
 * 예상 도착 시간(ETA)을 계산합니다.
 *
 * ETA = T_current + T_wait + T_travel
 */
export class ETACalculator {
  private realtimeService: RealtimeTransitService;
  private intercityService: IntercityBusService;

  constructor() {
    this.realtimeService = new RealtimeTransitService();
    this.intercityService = new IntercityBusService();
  }

  /**
   * 운행 시간 외 ETAResult를 반환합니다.
   */
  private offHoursETA(route: SavedRouteWithLegs): ETAResult {
    return {
      estimatedArrival: "",
      waitTime: 0,
      travelTime: route.totalTime,
      isEstimate: true,
      routeId: route.id,
      routeAlias: route.alias,
      routeType: route.routeType as RouteType,
      routeSource: (route.routeSource as "in_local" | "inter_local") ?? undefined,
      legArrivals: [],
    };
  }

  /**
   * 사전에 조회된 도착 정보로부터 ETAResult를 계산합니다.
   * (실제 API 호출 없음 — 순수 계산)
   */
  private buildETAResult(
    route: SavedRouteWithLegs,
    now: Date,
    allArrivals: CityArrivalEntry[],
    intercityResults: Array<{ leg: RouteLeg; departures: IntercityDeparture[] }>
  ): ETAResult {
    const transitLegs = route.legs.filter(
      (leg) => leg.type === "bus" || leg.type === "subway"
    );

    // route.legs 순서대로 도착 정보를 구성
    const legArrivals: LegArrivalInfo[] = [];

    for (const leg of transitLegs) {
      if (isIntercityBusLeg(leg, route.routeSource)) {
        // 시외버스 구간: 시간표 기반
        const result = intercityResults.find((r) => r.leg === leg);
        if (result && result.departures.length > 0) {
          for (const dep of result.departures) {
            legArrivals.push({
              type: "bus",
              lineName: leg.lineNames[0] || "시외버스",
              arrivalMessage: `${dep.departureTime} 출발 (${dep.waitMinutes}분 후)`,
              arrivalTime: dep.waitMinutes * 60,
              startStation: leg.startStation ?? undefined,
              endStation: leg.endStation ?? undefined,
              isSchedule: true,
            });
          }
        } else {
          legArrivals.push({
            type: "bus",
            lineName: leg.lineNames[0] || "시외버스",
            arrivalMessage: "배차 정보 없음",
            arrivalTime: AVERAGE_HEADWAY.bus,
            startStation: leg.startStation ?? undefined,
            endStation: leg.endStation ?? undefined,
            isSchedule: true,
          });
        }
      } else {
        // 시내 구간: 실시간 도착 정보
        const realtimeData = allArrivals.find(
          (a) => a.startStation === (leg.startStation ?? undefined)
        );

        if (realtimeData && realtimeData.arrivals.length > 0) {
          for (const a of realtimeData.arrivals) {
            legArrivals.push({
              type: realtimeData.type,
              lineName: a.lineName,
              arrivalMessage: a.arrivalMessage,
              arrivalTime: a.arrivalTime,
              startStation: realtimeData.startStation,
              endStation: realtimeData.endStation,
              destination: a.destination,
            });
          }
        } else {
          for (const name of leg.lineNames) {
            legArrivals.push({
              type: leg.type as "bus" | "subway",
              lineName: name,
              arrivalMessage: "실시간 정보 없음",
              arrivalTime:
                AVERAGE_HEADWAY[leg.type as "bus" | "subway"] ??
                AVERAGE_HEADWAY.bus,
              startStation: leg.startStation ?? undefined,
              endStation: leg.endStation ?? undefined,
            });
          }
        }
      }
    }

    // 대기 시간 결정: 첫 번째 대중교통 구간 기준
    let waitTime: number; // 초
    let isEstimate: boolean;

    const firstLeg = transitLegs[0];
    if (firstLeg && isIntercityBusLeg(firstLeg, route.routeSource)) {
      // 첫 구간이 시외버스인 경우
      const firstIntercity = intercityResults.find((r) => r.leg === firstLeg);
      if (firstIntercity && firstIntercity.departures.length > 0) {
        waitTime = firstIntercity.departures[0].waitMinutes * 60;
        isEstimate = false;
      } else {
        waitTime = AVERAGE_HEADWAY.bus;
        isEstimate = true;
      }
    } else if (allArrivals.length > 0) {
      waitTime = allArrivals[0].arrivals[0]?.arrivalTime ?? 0;
      isEstimate = false;
    } else {
      const firstType = firstLeg?.type as "bus" | "subway" | undefined;
      waitTime =
        firstType && firstType in AVERAGE_HEADWAY
          ? AVERAGE_HEADWAY[firstType]
          : AVERAGE_HEADWAY.bus;
      isEstimate = true;
    }

    // T_travel: 총 소요 시간 (분, DB 저장값)
    const travelTime = route.totalTime;

    // ETA 계산: 현재 시간 + 대기 시간(초) + 이동 시간(분)
    const estimatedArrival = new Date(
      now.getTime() + waitTime * 1000 + travelTime * 60 * 1000
    ).toISOString();

    return {
      estimatedArrival,
      waitTime,
      travelTime,
      isEstimate,
      routeId: route.id,
      routeAlias: route.alias,
      routeType: route.routeType as RouteType,
      routeSource: (route.routeSource as "in_local" | "inter_local") ?? undefined,
      legArrivals,
    };
  }

  /**
   * 고유 시내 transit leg 목록을 받아 병렬로 도착 정보를 조회하고
   * key → CityArrivalEntry 맵을 반환합니다.
   * (방안 1의 gyeonggiStationId DB 영속화 콜백 포함)
   */
  private async fetchCityArrivalsCache(
    entries: [string, RouteLeg][]
  ): Promise<Map<string, CityArrivalEntry | null>> {
    const cache = new Map<string, CityArrivalEntry | null>();
    await Promise.all(
      entries.map(async ([key, leg]) => {
        const results = await this.realtimeService.getAllTransitArrivals([leg], {
          onResolvedGyeonggiStation: (legId, stationId) => {
            prisma.routeLeg
              .update({ where: { id: legId }, data: { gyeonggiStationId: stationId } })
              .catch((err) => console.error("[ETACalculator] gyeonggiStationId 저장 실패:", err));
          },
        });
        cache.set(key, results[0] ?? null);
      })
    );
    return cache;
  }

  /**
   * 고유 시외버스 leg 목록을 받아 병렬로 시간표를 조회하고
   * key → IntercityDeparture[] 맵을 반환합니다.
   */
  private async fetchIntercityCache(
    entries: [string, RouteLeg][]
  ): Promise<Map<string, IntercityDeparture[]>> {
    const cache = new Map<string, IntercityDeparture[]>();
    await Promise.all(
      entries.map(async ([key, leg]) => {
        const departures = await this.intercityService.getUpcomingDepartures(
          leg.startStation ?? "",
          leg.endStation ?? "",
          2
        );
        cache.set(key, departures);
      })
    );
    return cache;
  }

  /**
   * 단일 저장 경로에 대한 ETA를 계산합니다.
   * (독립 사용 또는 테스트용 — 내부에서 직접 API 조회)
   *
   * @param route - Prisma SavedRoute (legs 포함)
   * @returns ETAResult
   */
  async calculateETA(route: SavedRouteWithLegs): Promise<ETAResult> {
    const now = new Date();

    if (isOffHours()) {
      return this.offHoursETA(route);
    }

    // 대중교통 구간을 시내/시외로 분류
    const transitLegs = route.legs.filter(
      (leg) => leg.type === "bus" || leg.type === "subway"
    );

    const cityLegs = transitLegs.filter(
      (leg) => !isIntercityBusLeg(leg, route.routeSource)
    );
    const intercityLegs = transitLegs.filter((leg) =>
      isIntercityBusLeg(leg, route.routeSource)
    );

    // 시내 실시간 + 시외 시간표를 병렬 조회
    const [allArrivals, intercityResults] = await Promise.all([
      cityLegs.length > 0
        ? this.realtimeService.getAllTransitArrivals(cityLegs, {
            onResolvedGyeonggiStation: (legId, stationId) => {
              prisma.routeLeg
                .update({ where: { id: legId }, data: { gyeonggiStationId: stationId } })
                .catch((err) => console.error("[ETACalculator] gyeonggiStationId 저장 실패:", err));
            },
          })
        : Promise.resolve([]),
      Promise.all(
        intercityLegs.map(async (leg) => ({
          leg,
          departures: await this.intercityService.getUpcomingDepartures(
            leg.startStation ?? "",
            leg.endStation ?? "",
            2
          ),
        }))
      ),
    ]);

    return this.buildETAResult(route, now, allArrivals, intercityResults);
  }

  /**
   * 사용자의 모든 저장 경로에 대한 ETA를 계산합니다.
   * 기본 경로가 먼저, 나머지는 생성일 역순으로 정렬됩니다.
   *
   * 최적화: 모든 경로의 transit leg를 먼저 수집 → 중복 제거 →
   * 고유 정류장/역당 1회만 API 호출 → 결과를 각 경로에 분배.
   *
   * @param userId - 사용자 ID
   * @returns DashboardResponse
   */
  async calculateAllETAs(userId: string): Promise<DashboardResponse> {
    const routes = await RouteService.getRoutes(userId);
    const now = new Date();

    let etaResults: ETAResult[];

    if (isOffHours()) {
      etaResults = routes.map((route) => this.offHoursETA(route));
    } else {
      // 1. 모든 경로에서 고유 transit leg 수집 (중복 제거)
      const cityLegMap = new Map<string, RouteLeg>();
      const intercityLegMap = new Map<string, RouteLeg>();

      for (const route of routes) {
        for (const leg of route.legs) {
          if (leg.type !== "bus" && leg.type !== "subway") continue;
          if (isIntercityBusLeg(leg, route.routeSource)) {
            const key = buildIntercityLegKey(leg);
            if (!intercityLegMap.has(key)) intercityLegMap.set(key, leg);
          } else {
            const key = buildCityLegKey(leg);
            if (!cityLegMap.has(key)) cityLegMap.set(key, leg);
          }
        }
      }

      // 2. 고유 leg만 병렬 배치 조회
      const [cityCache, intercityCache] = await Promise.all([
        this.fetchCityArrivalsCache([...cityLegMap.entries()]),
        this.fetchIntercityCache([...intercityLegMap.entries()]),
      ]);

      // 3. 경로별 ETA 계산 (캐시에서 조회 — 추가 API 호출 없음)
      etaResults = routes.map((route) => {
        const transitLegs = route.legs.filter(
          (leg) => leg.type === "bus" || leg.type === "subway"
        );
        const cityLegs = transitLegs.filter(
          (leg) => !isIntercityBusLeg(leg, route.routeSource)
        );
        const intercityLegs = transitLegs.filter((leg) =>
          isIntercityBusLeg(leg, route.routeSource)
        );

        // 이 경로의 city legs에 해당하는 arrivals 조립
        const allArrivals: CityArrivalEntry[] = [];
        for (const leg of cityLegs) {
          const entry = cityCache.get(buildCityLegKey(leg));
          if (entry) allArrivals.push(entry);
        }

        // 이 경로의 intercity legs에 해당하는 결과 조립
        const intercityResults = intercityLegs.map((leg) => ({
          leg,
          departures: intercityCache.get(buildIntercityLegKey(leg)) ?? [],
        }));

        return this.buildETAResult(route, now, allArrivals, intercityResults);
      });
    }

    // 현재 시각(KST) 기준으로 경로 타입별 정렬
    // 13시 이전: 출근 우선, 13시 이후: 퇴근 우선
    const kstHour = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hour12: false,
    });
    const isCommuteTime = Number(kstHour) < 13;

    const priority: Record<string, number> = isCommuteTime
      ? { commute: 0, other: 1, return: 2 }
      : { return: 0, other: 1, commute: 2 };

    etaResults.sort(
      (a, b) => (priority[a.routeType] ?? 1) - (priority[b.routeType] ?? 1)
    );

    // ETA 기록 저장 (비동기, 실패해도 무시)
    this.recordETAs(etaResults).catch((err) =>
      console.error("[ETACalculator] ETA 기록 저장 실패:", err)
    );

    return {
      routes: etaResults,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * ETA 결과를 DB에 기록합니다 (통계용).
   * 추정치가 아닌 실제 데이터만 저장하며, 같은 경로는 5분 이내 중복 저장하지 않습니다.
   */
  private async recordETAs(results: ETAResult[]): Promise<void> {
    const realResults = results.filter((r) => !r.isEstimate && r.estimatedArrival);
    if (realResults.length === 0) return;

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    for (const r of realResults) {
      // 5분 이내 동일 경로 기록이 있으면 건너뜀
      const recent = await prisma.eTARecord.findFirst({
        where: { routeId: r.routeId, recordedAt: { gte: fiveMinAgo } },
        select: { id: true },
      });
      if (recent) continue;

      await prisma.eTARecord.create({
        data: {
          routeId: r.routeId,
          totalETA: r.waitTime + r.travelTime * 60,
          waitTime: r.waitTime,
          travelTime: r.travelTime,
          isEstimate: r.isEstimate,
        },
      });
    }
  }
}
