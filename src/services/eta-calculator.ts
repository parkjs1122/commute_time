import { RealtimeTransitService } from "@/services/realtime-transit";
import { RouteService } from "@/services/route-service";
import type { ETAResult, LegArrivalInfo, DashboardResponse, SavedRouteWithLegs } from "@/types";
import { isOffHours } from "@/lib/time-utils";

/** 평균 배차 간격 (초) */
const AVERAGE_HEADWAY = {
  bus: 600, // 10분
  subway: 300, // 5분
} as const;

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

  constructor() {
    this.realtimeService = new RealtimeTransitService();
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
        legArrivals: [],
      };
    }

    // 모든 대중교통 구간의 실시간 도착 정보 조회
    const allArrivals = await this.realtimeService.getAllTransitArrivals(
      route.legs
    );

    let waitTime: number; // 초
    let isEstimate: boolean;
    let legArrivals: LegArrivalInfo[];

    // route.legs 순서대로 도착 정보를 구성 (실시간 정보 유무와 관계없이 순서 유지)
    const transitLegs = route.legs.filter(
      (leg) => leg.type === "bus" || leg.type === "subway"
    );

    legArrivals = [];
    for (const leg of transitLegs) {
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

    if (allArrivals.length > 0) {
      waitTime = allArrivals[0].arrivals[0]?.arrivalTime ?? 0;
      isEstimate = false;
    } else {
      const firstType = transitLegs[0]?.type as "bus" | "subway" | undefined;
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

    return {
      routes: etaResults,
      lastUpdated: new Date().toISOString(),
    };
  }
}
