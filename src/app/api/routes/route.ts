import { NextRequest, NextResponse } from "next/server";
import { RouteService } from "@/services/route-service";
import { requireAuth, parseRequestBody, handleApiError, BadRequestError } from "@/lib/errors";
import type { SaveRouteRequest } from "@/types";

/**
 * GET /api/routes
 * 인증된 사용자의 저장된 경로 목록을 반환합니다.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const routes = await RouteService.getRoutes(session.user.id);
    return NextResponse.json(routes);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/routes
 * 새 경로를 저장합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await parseRequestBody<SaveRouteRequest>(request);

    // 기본 유효성 검증
    if (!body.alias || !body.origin || !body.destination || !body.route) {
      throw new BadRequestError(
        "alias, origin, destination, route 필드가 모두 필요합니다."
      );
    }

    const savedRoute = await RouteService.saveRoute(
      session.user.id,
      body
    );

    return NextResponse.json(savedRoute, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
