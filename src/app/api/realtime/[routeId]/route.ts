import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RealtimeTransitService } from "@/services/realtime-transit";
import { IntercityBusService } from "@/services/intercity-bus-service";
import { isOffHours } from "@/lib/time-utils";
import { requireAuth, handleApiError, NotFoundError, ForbiddenError, BadRequestError } from "@/lib/errors";
import type { ArrivalInfo } from "@/types";

/**
 * Leg이 시외/고속버스 구간인지 판별합니다.
 */
function isIntercityBusLeg(
  leg: { type: string; legSubType?: string | null; startStationId?: string | null },
  routeSource?: string | null
): boolean {
  if (leg.legSubType === "intercity_bus" || leg.legSubType === "express_bus") {
    return true;
  }
  if (routeSource === "inter_local" && leg.type === "bus" && !leg.startStationId) {
    return true;
  }
  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  try {
    const session = await requireAuth();
    const { routeId } = await params;

    // 저장된 경로 조회 (legs 포함, userId 검증)
    const savedRoute = await prisma.savedRoute.findUnique({
      where: {
        id: routeId,
      },
      include: {
        legs: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!savedRoute) {
      throw new NotFoundError("저장된 경로를 찾을 수 없습니다.");
    }

    // 사용자 소유 확인
    if (savedRoute.userId !== session.user.id) {
      throw new ForbiddenError("해당 경로에 대한 접근 권한이 없습니다.");
    }

    // 대중교통 Leg이 없는 경우 (도보 전용 경로)
    const hasTransitLeg = savedRoute.legs.some(
      (leg: { type: string }) => leg.type === "bus" || leg.type === "subway"
    );

    if (!hasTransitLeg) {
      throw new BadRequestError("대중교통 구간이 없는 경로입니다.");
    }

    // 운행 시간 확인 (새벽 1시 ~ 5시는 운행 시간 외)
    if (isOffHours()) {
      return NextResponse.json({
        message: "현재 운행 시간이 아닙니다",
        arrivalInfo: null,
        offHours: true,
      });
    }

    // 시내/시외 구간 분리
    const cityLegs = savedRoute.legs.filter(
      (leg) =>
        (leg.type === "bus" || leg.type === "subway") &&
        !isIntercityBusLeg(leg, savedRoute.routeSource)
    );
    const intercityLegs = savedRoute.legs.filter(
      (leg) =>
        leg.type === "bus" &&
        isIntercityBusLeg(leg, savedRoute.routeSource)
    );

    // 시내 실시간 + 시외 시간표 병렬 조회
    const realtimeService = new RealtimeTransitService();
    const intercityService = new IntercityBusService();

    const [cityArrivals, intercityResults] = await Promise.all([
      cityLegs.length > 0
        ? realtimeService.getAllTransitArrivals(cityLegs, {
            onResolvedGyeonggiStation: (legId, stationId) => {
              prisma.routeLeg.update({
                where: { id: legId },
                data: { gyeonggiStationId: stationId },
              }).catch((err) => console.error("[RealtimeAPI] gyeonggiStationId 저장 실패:", err));
            },
          })
        : Promise.resolve([]),
      Promise.all(
        intercityLegs.map(async (leg) => ({
          leg,
          departures: await intercityService.getUpcomingDepartures(
            leg.startStation ?? "",
            leg.endStation ?? "",
            2
          ),
        }))
      ),
    ]);

    // 결과 통합
    const arrivals: ArrivalInfo[] = cityArrivals.flatMap(({ arrivals }) => arrivals);

    // 시외버스 시간표를 ArrivalInfo 형태로 변환
    for (const result of intercityResults) {
      for (const dep of result.departures) {
        arrivals.push({
          stationName: result.leg.startStation ?? "",
          lineName: result.leg.lineNames[0] || "시외버스",
          direction: `${result.leg.endStation ?? ""} 방면`,
          arrivalTime: dep.waitMinutes * 60,
          arrivalMessage: `${dep.departureTime} 출발 (${dep.waitMinutes}분 후)`,
          vehicleType: "시외버스",
        });
      }
    }

    if (arrivals.length === 0) {
      return NextResponse.json({
        message: "현재 도착 정보가 없습니다.",
        arrivals: [],
        offHours: false,
      });
    }

    return NextResponse.json({
      arrivals,
      offHours: false,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
