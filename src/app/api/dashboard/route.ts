import { NextResponse } from "next/server";
import { ETACalculator } from "@/services/eta-calculator";
import { requireAuth, handleApiError } from "@/lib/errors";

/**
 * GET /api/dashboard
 *
 * 사용자의 모든 저장 경로에 대한 ETA를 계산하여 반환합니다.
 * - 기본 경로가 먼저, 나머지는 생성일 역순 정렬
 * - 인증 필수
 */
export async function GET() {
  try {
    const session = await requireAuth();

    // ETA 계산
    const calculator = new ETACalculator();
    const dashboardResponse = await calculator.calculateAllETAs(
      session.user.id
    );

    return NextResponse.json(dashboardResponse);
  } catch (error) {
    return handleApiError(error);
  }
}
