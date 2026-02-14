import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RealtimeTransitService } from "@/services/realtime-transit";
import { isOffHours } from "@/lib/time-utils";
import { requireAuth, handleApiError, NotFoundError, ForbiddenError, BadRequestError } from "@/lib/errors";

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

    // 실시간 도착 정보 조회 (모든 대중교통 구간)
    const service = new RealtimeTransitService();
    const allArrivals = await service.getAllTransitArrivals(savedRoute.legs);

    // 모든 구간의 도착 정보를 합침
    const arrivals = allArrivals.flatMap(({ arrivals }) => arrivals);

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
