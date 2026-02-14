import { NextRequest, NextResponse } from "next/server";
import { RouteService } from "@/services/route-service";
import { requireAuth, handleApiError } from "@/lib/errors";

/**
 * PATCH /api/routes/[id]/default
 * 경로를 기본 경로로 설정합니다.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const updatedRoute = await RouteService.setDefault(
      id,
      session.user.id
    );

    return NextResponse.json(updatedRoute);
  } catch (error) {
    return handleApiError(error);
  }
}
