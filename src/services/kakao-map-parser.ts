import { TransitRoute, RouteLeg } from "@/types";
import { kakaoMapParserLimiter } from "@/lib/rate-limiter";
import { RateLimitError } from "@/lib/errors";

interface RouteOriginDest {
  name: string;
  lat: number;
  lng: number;
}

/** 카카오 pubtrans.json API 응답 타입 (필요한 필드만 정의) */
interface KakaoRouteResponse {
  in_local_status: string;
  in_local?: {
    routes: KakaoRoute[];
  };
  inter_local_status?: string;
  inter_local?: {
    routes: KakaoInterLocalRoute[];
  };
}

/** 시내(in_local) 경로 */
interface KakaoRoute {
  time: { value: number }; // 초
  walkingTime?: { value: number }; // 초
  transfers: number;
  fare?: { value?: number; minValue?: number; maxValue?: number };
  steps: KakaoStep[];
}

/** 시외(inter_local) 경로 */
interface KakaoInterLocalRoute {
  totalTime: { value: number }; // 분
  time: { value: number }; // 분 (열차 구간)
  fare?: { value: number };
  transfers: number;
  vehicles?: string; // e.g. "KTX"
  vehicle?: string;
  sectionRoutes: KakaoSectionRoute[];
}

/** 시외 경로의 구간 */
interface KakaoSectionRoute {
  time: { value: number }; // 초
  fare?: { value: number } | null;
  vehicle: { type: string; subType?: string | null };
  departure: { id?: string | null; type: string; name: string; x: number; y: number };
  arrival: { id?: string | null; type: string; name: string; x: number; y: number };
  transferRoute?: {
    route: {
      walkingTime?: { value: number };
      steps: KakaoStep[];
    };
  } | null;
}

interface KakaoStep {
  action: "DEPARTURE" | "MOVE" | "GETON" | "TRANSFER" | "GETOFF" | "ARRIVAL";
  type?: "WALKING" | "BUS" | "SUBWAY";
  time?: { value: number };
  distance?: { value: number };
  startLocation?: KakaoLocation;
  endLocation?: KakaoLocation;
  vehicles?: KakaoVehicle[];
}

interface KakaoLocation {
  type?: string;
  name: string;
  displayId?: string;
  subwayId?: string;
}

interface KakaoVehicle {
  type: string;
  name: string;
  visible: boolean;
}

/**
 * KakaoMapParser
 *
 * 카카오맵 대중교통 경로 JSON API를 호출하여 경로 데이터를 추출합니다.
 *
 * API: https://map.kakao.com/route/pubtrans.json
 * 좌표계: WCONGNAMUL (카카오 transcoord API로 WGS84에서 변환)
 */
export class KakaoMapParser {
  private static readonly TIMEOUT_MS = 15_000;
  /** 재시도 최대 횟수 */
  private static readonly MAX_RETRIES = 2;
  /** 재시도 초기 대기 시간(ms) */
  private static readonly RETRY_BASE_DELAY_MS = 1_000;

  /** 카카오맵 웹사이트가 실제로 보내는 것과 유사한 브라우저 헤더 */
  private static readonly BROWSER_HEADERS: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://map.kakao.com/",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  };

  private kakaoApiKey: string;

  constructor() {
    this.kakaoApiKey = process.env.KAKAO_REST_API_KEY || "";
  }

  /**
   * 지수 백오프 재시도가 포함된 fetch 래퍼.
   * 429(Too Many Requests), 503(Service Unavailable) 등 일시적 오류 시 재시도합니다.
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    context: string
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= KakaoMapParser.MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay =
          KakaoMapParser.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          `[KakaoMapParser] ${context} 재시도 ${attempt}/${KakaoMapParser.MAX_RETRIES} (${delay}ms 대기)`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        const response = await fetch(url, options);

        // 성공 또는 클라이언트 오류(4xx, 단 429 제외)는 즉시 반환
        if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
          return response;
        }

        // 429 또는 5xx는 재시도 대상
        lastError = new Error(`HTTP ${response.status}`);
        console.warn(
          `[KakaoMapParser] ${context} HTTP ${response.status} 응답 수신`
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // 타임아웃이나 네트워크 오류도 재시도
        console.warn(
          `[KakaoMapParser] ${context} 요청 실패: ${lastError.message}`
        );
      }
    }

    throw new Error(
      `${context} 실패 (${KakaoMapParser.MAX_RETRIES + 1}회 시도): ${lastError?.message}`
    );
  }

  /**
   * WGS84 좌표를 WCONGNAMUL 좌표로 변환합니다.
   * 카카오 transcoord API 사용.
   */
  private async toWcongnamul(
    lat: number,
    lng: number
  ): Promise<{ x: number; y: number }> {
    const params = new URLSearchParams({
      x: String(lng),
      y: String(lat),
      input_coord: "WGS84",
      output_coord: "WCONGNAMUL",
    });

    const response = await this.fetchWithRetry(
      `https://dapi.kakao.com/v2/local/geo/transcoord.json?${params}`,
      {
        headers: {
          Authorization: `KakaoAK ${this.kakaoApiKey}`,
          ...KakaoMapParser.BROWSER_HEADERS,
        },
        signal: AbortSignal.timeout(KakaoMapParser.TIMEOUT_MS),
      },
      "좌표 변환 API"
    );

    if (!response.ok) {
      throw new Error(`좌표 변환 API 실패: HTTP ${response.status}`);
    }

    const data = await response.json();
    const doc = data.documents?.[0];
    if (!doc) {
      throw new Error("좌표 변환 결과가 없습니다.");
    }

    return { x: Math.round(doc.x), y: Math.round(doc.y) };
  }

  /**
   * pubtrans.json API URL을 생성합니다.
   */
  private buildApiUrl(
    origin: { name: string; x: number; y: number },
    dest: { name: string; x: number; y: number }
  ): string {
    const params = new URLSearchParams({
      inputCoordSystem: "WCONGNAMUL",
      outputCoordSystem: "WCONGNAMUL",
      service: "map.daum.net",
      sX: String(origin.x),
      sY: String(origin.y),
      sName: origin.name,
      eX: String(dest.x),
      eY: String(dest.y),
      eName: dest.name,
    });

    return `https://map.kakao.com/route/pubtrans.json?${params}`;
  }

  /**
   * 출발지와 목적지 사이의 대중교통 경로를 검색합니다.
   */
  async parseTransitRoutes(
    origin: RouteOriginDest,
    destination: RouteOriginDest
  ): Promise<TransitRoute[]> {
    try {
      if (!this.kakaoApiKey) {
        throw new Error("KAKAO_REST_API_KEY가 설정되지 않았습니다.");
      }

      // Rate Limit 체크 (분당 5회 제한)
      const rateLimitKey = "kakao-pubtrans";
      if (!kakaoMapParserLimiter.canMakeRequest(rateLimitKey)) {
        const retryAfter = kakaoMapParserLimiter.getRetryAfterMs(rateLimitKey);
        throw new RateLimitError(
          `카카오맵 요청 빈도 제한 초과. ${Math.ceil(retryAfter / 1000)}초 후 다시 시도해주세요.`
        );
      }
      kakaoMapParserLimiter.recordRequest(rateLimitKey);

      // WGS84 → WCONGNAMUL 좌표 변환 (병렬)
      const [originCoord, destCoord] = await Promise.all([
        this.toWcongnamul(origin.lat, origin.lng),
        this.toWcongnamul(destination.lat, destination.lng),
      ]);

      // 경로 API 호출
      const url = this.buildApiUrl(
        { name: origin.name, ...originCoord },
        { name: destination.name, ...destCoord }
      );

      const response = await this.fetchWithRetry(
        url,
        {
          headers: KakaoMapParser.BROWSER_HEADERS,
          signal: AbortSignal.timeout(KakaoMapParser.TIMEOUT_MS),
        },
        "경로 API"
      );

      if (!response.ok) {
        throw new Error(`경로 API 요청 실패: HTTP ${response.status}`);
      }

      const data: KakaoRouteResponse = await response.json();

      // 시내(in_local) 경로 파싱
      const inLocalRoutes: TransitRoute[] =
        data.in_local_status === "SUCCESS" && data.in_local?.routes
          ? data.in_local.routes
              .map((route) => this.mapRoute(route, "in_local"))
              .filter((r): r is TransitRoute => r !== null)
          : [];

      // 시외(inter_local) 경로 파싱
      const interLocalRoutes: TransitRoute[] =
        data.inter_local_status === "SUCCESS" && data.inter_local?.routes
          ? data.inter_local.routes
              .map((route) => this.mapInterLocalRoute(route))
              .filter((r): r is TransitRoute => r !== null)
          : [];

      const routes = [...inLocalRoutes, ...interLocalRoutes].sort(
        (a, b) => a.totalTime - b.totalTime
      );

      if (routes.length === 0) {
        console.warn(
          `[KakaoMapParser] 경로 결과 없음: ${origin.name} -> ${destination.name}`
        );
      }

      return routes;
    } catch (error) {
      // AppError 하위 클래스(RateLimitError 등)는 그대로 재throw
      if (error instanceof RateLimitError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[KakaoMapParser] 경로 검색 오류: ${message}`);
      throw new Error(`경로 검색 중 오류가 발생했습니다: ${message}`);
    }
  }

  /**
   * 카카오 API 경로 응답을 TransitRoute로 변환합니다.
   */
  private mapRoute(
    route: KakaoRoute,
    routeSource: "in_local" | "inter_local"
  ): TransitRoute | null {
    try {
      const totalTime = Math.round(route.time.value / 60);
      if (totalTime <= 0) return null;

      const legs = this.mapLegs(route.steps);

      return {
        totalTime,
        transferCount: route.transfers,
        walkTime: Math.round((route.walkingTime?.value ?? 0) / 60),
        fare: route.fare?.value ?? route.fare?.minValue,
        legs,
        routeSource,
      };
    } catch (err) {
      console.error(`[KakaoMapParser] mapRoute 오류 (${routeSource}):`, err);
      return null;
    }
  }

  /**
   * 시외(inter_local) 경로를 TransitRoute로 변환합니다.
   *
   * inter_local 경로는 sectionRoutes 배열로 구성되며,
   * 각 구간은 열차(TRAIN) 또는 환승 대중교통(TRANSFER_PUBLICTRAFFIC)입니다.
   */
  private mapInterLocalRoute(
    route: KakaoInterLocalRoute
  ): TransitRoute | null {
    try {
      const totalTime = route.totalTime.value; // 이미 분 단위
      if (totalTime <= 0) return null;

      const legs: RouteLeg[] = [];
      let totalWalkTime = 0;

      for (const section of route.sectionRoutes) {
        if (
          section.vehicle.type === "TRANSFER_PUBLICTRAFFIC" &&
          section.transferRoute?.route
        ) {
          // 환승 구간: 시내 대중교통 (버스/지하철)
          const sectionLegs = this.mapLegs(
            section.transferRoute.route.steps
          );
          legs.push(...sectionLegs);
          totalWalkTime += Math.round(
            (section.transferRoute.route.walkingTime?.value ?? 0) / 60
          );
        } else if (
          section.vehicle.type === "TRAIN" ||
          section.vehicle.type === "EXPRESS_BUS" ||
          section.vehicle.type === "INTERCITY_BUS"
        ) {
          // 열차/시외버스 구간
          const lineName =
            section.vehicle.subType ??
            route.vehicles ??
            section.vehicle.type;
          legs.push({
            type: "bus",
            lineNames: [lineName],
            startStation: section.departure.name,
            endStation: section.arrival.name,
            sectionTime: Math.round(section.time.value / 60),
          });
        }
      }

      return {
        totalTime,
        transferCount: route.transfers,
        walkTime: totalWalkTime,
        fare: route.fare?.value,
        legs,
        routeSource: "inter_local",
      };
    } catch (err) {
      console.error("[KakaoMapParser] mapInterLocalRoute 오류:", err);
      return null;
    }
  }

  /**
   * API steps를 RouteLeg 배열로 변환합니다.
   *
   * - GETON: 새 대중교통 구간 시작
   * - TRANSFER: 현재 구간 종료 후 새 구간 시작 (버스/지하철 환승)
   * - GETOFF: 현재 구간 종료
   */
  private mapLegs(steps: KakaoStep[]): RouteLeg[] {
    const legs: RouteLeg[] = [];
    let currentLeg: RouteLeg | null = null;

    for (const step of steps) {
      if (step.action === "GETON") {
        const type = step.type === "SUBWAY" ? "subway" : "bus";
        const lineNames = [
          ...new Set(
            (step.vehicles ?? []).filter((v) => v.visible).map((v) => v.name)
          ),
        ];

        currentLeg = {
          type,
          lineNames,
          startStation: step.startLocation?.name,
          endStation: step.endLocation?.name,
          startStationId: step.startLocation?.displayId ?? undefined,
          sectionTime: Math.round((step.time?.value ?? 0) / 60),
        };
        legs.push(currentLeg);
      } else if (step.action === "TRANSFER" && currentLeg) {
        // 환승: 현재 구간을 종료하고 새 구간 시작
        if (step.startLocation) {
          currentLeg.endStation = step.startLocation.name;
        }

        const type = step.type === "SUBWAY" ? "subway" : "bus";
        const lineNames = [
          ...new Set(
            (step.vehicles ?? []).filter((v) => v.visible).map((v) => v.name)
          ),
        ];

        currentLeg = {
          type,
          lineNames,
          startStation: step.startLocation?.name,
          endStation: step.endLocation?.name,
          startStationId: step.startLocation?.displayId ?? undefined,
          sectionTime: Math.round((step.time?.value ?? 0) / 60),
        };
        legs.push(currentLeg);
      } else if (step.action === "GETOFF") {
        if (currentLeg && step.endLocation) {
          currentLeg.endStation = step.endLocation.name;
        }
        currentLeg = null;
      }
    }

    return legs;
  }
}
