import { RealtimeTransitService } from "@/services/realtime-transit";
import { IntercityBusService } from "@/services/intercity-bus-service";
import { RouteService } from "@/services/route-service";
import type { ETAResult, LegArrivalInfo, DashboardResponse, SavedRouteWithLegs, RouteType } from "@/types";
import { isOffHours } from "@/lib/time-utils";

/** 평균 배차 간격 (초) */
const AVERAGE_HEADWAY = {
  bus: 600, // 10분
  subway: 300, // 5분
} as const;

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
   * 단일 저장 경로에 대한 ETA를 계산합니다.
   *
   * @param route - Prisma SavedRoute (legs 포함)
   * @returns ETAResult
   */
  async calculateETA(route: SavedRouteWithLegs): Promise<ETAResult> {
    const now = new Date();

    // 운행 시간 외 체크 (새벽 1시 ~ 5시 KST)
    if (isOffHours()) {
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
        ? this.realtimeService.getAllTransitArrivals(cityLegs)
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
        // 시내 구간: 기존 실시간 도착 정보
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
   * 사용자의 모든 저장 경로에 대한 ETA를 계산합니다.
   * 기본 경로가 먼저, 나머지는 생성일 역순으로 정렬됩니다.
   *
   * @param userId - 사용자 ID
   * @returns DashboardResponse
   */
  async calculateAllETAs(userId: string): Promise<DashboardResponse> {
    // RouteService를 통해 사용자의 모든 경로 조회 (isDefault desc, createdAt desc)
    const routes = await RouteService.getRoutes(userId);

    // 모든 경로에 대해 병렬로 ETA 계산
    const etaResults = await Promise.all(
      routes.map((route) => this.calculateETA(route))
    );

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

    return {
      routes: etaResults,
      lastUpdated: new Date().toISOString(),
    };
  }
}
