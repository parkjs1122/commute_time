import { NextRequest, NextResponse } from "next/server";
import { RouteService } from "@/services/route-service";
import { requireAuth, parseRequestBody, handleApiError, BadRequestError } from "@/lib/errors";

const VALID_ROUTE_TYPES = ["commute", "return", "other"];

/**
 * PATCH /api/routes/[id]
 * 경로 별칭 또는 경로 타입을 수정합니다.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await parseRequestBody<{ alias?: string; routeType?: string }>(request);

    if (!body.alias && !body.routeType) {
      throw new BadRequestError("alias 또는 routeType 필드가 필요합니다.");
    }

    let updatedRoute;

    if (body.alias && typeof body.alias === "string") {
      updatedRoute = await RouteService.updateAlias(
        id,
        session.user.id,
        body.alias
      );
    }

    if (body.routeType) {
      if (!VALID_ROUTE_TYPES.includes(body.routeType)) {
        throw new BadRequestError("routeType은 commute, return, other 중 하나여야 합니다.");
      }
      updatedRoute = await RouteService.updateRouteType(
        id,
        session.user.id,
        body.routeType
      );
    }

    return NextResponse.json(updatedRoute);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/routes/[id]
 * 경로를 삭제합니다.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    await RouteService.deleteRoute(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
