import { Place } from "@/types";

interface KakaoPlaceDocument {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
  category_group_name: string;
}

interface KakaoSearchResponse {
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
  documents: KakaoPlaceDocument[];
}

export class PlaceSearchService {
  private apiKey: string;
  private baseUrl = "https://dapi.kakao.com/v2/local/search/keyword.json";

  constructor() {
    this.apiKey = process.env.KAKAO_REST_API_KEY || "";
  }

  async searchByKeyword(query: string, page: number = 1): Promise<Place[]> {
    if (!this.apiKey) {
      throw new Error("KAKAO_REST_API_KEY 환경 변수가 설정되지 않았습니다.");
    }

    const params = new URLSearchParams({
      query,
      page: String(page),
      size: "15",
    });

    const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
      headers: {
        Authorization: `KakaoAK ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `카카오 API 요청 실패 (${response.status}): ${errorText}`
      );
    }

    const data: KakaoSearchResponse = await response.json();

    return data.documents.map((doc) => this.mapToPlace(doc));
  }

  private mapToPlace(doc: KakaoPlaceDocument): Place {
    return {
      id: doc.id,
      name: doc.place_name,
      address: doc.address_name,
      roadAddress: doc.road_address_name,
      latitude: parseFloat(doc.y),
      longitude: parseFloat(doc.x),
      category: doc.category_group_name,
    };
  }
}
