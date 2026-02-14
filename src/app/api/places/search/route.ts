import { NextRequest, NextResponse } from "next/server";
import { PlaceSearchService } from "@/services/place-search";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_QUERY",
          message: "검색어를 입력해주세요.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const service = new PlaceSearchService();
    const places = await service.searchByKeyword(query.trim());

    return NextResponse.json({ places });
  } catch (error) {
    console.error("장소 검색 오류:", error);

    const message =
      error instanceof Error
        ? error.message
        : "장소 검색 중 오류가 발생했습니다.";

    return NextResponse.json(
      {
        error: {
          code: "SEARCH_FAILED",
          message,
        },
      },
      { status: 500 }
    );
  }
}
