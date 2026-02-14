import { NextRequest, NextResponse } from "next/server";
import { RouteService } from "@/services/route-service";
import { requireAuth, parseRequestBody, handleApiError, BadRequestError } from "@/lib/errors";

/**
 * PATCH /api/routes/[id]
 * 경로 별칭을 수정합니다.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await parseRequestBody<{ alias: string }>(request);

    if (!body.alias || typeof body.alias !== "string") {
      throw new BadRequestError("alias 필드가 필요합니다.");
    }

    const updatedRoute = await RouteService.updateAlias(
      id,
      session.user.id,
      body.alias
    );

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
