import { XMLParser } from "fast-xml-parser";
import { ArrivalInfo } from "@/types";
import { determineSubwayDirection } from "@/data/subway-stations";
import { willTrainReachStation, isStationKnown } from "@/data/subway-graph";

// 서울 버스 도착 정보 API XML 응답 타입
// API: http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid
interface BusArrivalItem {
  stId: string;
  stNm: string;
  arsId: string;
  busRouteId: string;
  rtNm: string;
  busRouteAbrv: string;
  sectOrd: string;
  stationNm: string;
  arrmsg1: string;
  arrmsg2: string;
  traTime1?: number; // 첫번째 버스 도착 예정 시간(초)
  traTime2?: number; // 두번째 버스 도착 예정 시간(초)
  isLast1?: number;
  isLast2?: number;
  rerideNum1?: number;
  rerideNum2?: number;
  sectNm?: string;
  nxtStn?: string;
  adirection?: string; // 방향 (예: "마포구청")
  routeType?: string; // 노선 유형 (1=공항, 2=마을, 3=간선, 4=지선 등)
  term?: number; // 배차간격(분)
}

interface BusArrivalResponse {
  ServiceResult?: {
    msgHeader?: {
      headerCd: string;
      headerMsg: string;
    };
    msgBody?: {
      itemList?: BusArrivalItem | BusArrivalItem[];
    };
  };
}

// 경기도 버스 도착 정보 API JSON 응답 타입
interface GyeonggiBusArrivalItem {
  stationId: number;
  routeId: number;
  routeName: string | number;
  routeTypeCd: number;
  staOrder: number;
  predictTime1: number | string; // 분 (빈문자열일 수 있음)
  predictTime2: number | string;
  predictTimeSec1?: number | string; // 초 (v2)
  predictTimeSec2?: number | string;
  locationNo1: number | string;
  locationNo2: number | string;
  flag: string; // RUN, STOP, PASS, WAIT
  stationNm1?: string;
  stationNm2?: string;
}

interface GyeonggiBusArrivalResponse {
  response: {
    comMsgHeader: string;
    msgHeader: {
      queryTime: string;
      resultCode: number;
      resultMessage: string;
    };
    msgBody: {
      busArrivalList?: GyeonggiBusArrivalItem | GyeonggiBusArrivalItem[];
    };
  };
}

// 서울 지하철 실시간 도착 정보 API JSON 응답 타입
interface SubwayArrivalItem {
  rowNum: number;
  selectedCount: number;
  subwayId: string;
  subwayNm?: string;
  updnLine: string; // "상행" | "하행" | "외선" | "내선"
  trainLineNm: string; // "방면 정보 (예: 신도림행 - 구로 방면)"
  statnFid?: string;
  statnTid?: string;
  statnId: string;
  statnNm: string;
  barvlDt: string; // 도착 예정 시간 (초)
  btrainSttus?: string; // 열차종류 (일반/급행)
  btrainNo: string;
  bstatnId?: string;
  bstatnNm?: string; // 종착역
  recptnDt: string;
  arvlMsg2: string; // 도착 메시지 (예: "3분 후 (당역)")
  arvlMsg3: string; // 도착 메시지 (예: "전역 도착")
  arvlCd: string; // 도착 코드 (0: 진입, 1: 도착, 2: 출발, 3: 전역출발, 4: 전역진입, 5: 전역도착, 99: 운행중)
  lstcarAt: string; // 막차 여부 (0: 아님, 1: 막차)
}

interface SubwayArrivalResponse {
  errorMessage?: {
    status: number;
    code: string;
    message: string;
    link: string;
    developerMessage: string;
    total: number;
  };
  realtimeArrivalList?: SubwayArrivalItem[];
}

// ── 서버 레벨 인메모리 TTL 캐시 (방안 3) ──────────────────────────────────
// RealtimeTransitService는 요청마다 인스턴스화되므로 캐시는 모듈 레벨에 유지.
// 같은 서버 인스턴스의 여러 사용자 요청이 동일 정류장 조회 시 API 재호출 방지.
const ARRIVAL_CACHE_TTL_MS = 20_000; // 20초

interface ArrivalCacheEntry<T> {
  data: T;
  expiresAt: number;
}

const _busArrivalCache = new Map<string, ArrivalCacheEntry<ArrivalInfo[]>>();
const _subwayRawCache = new Map<string, ArrivalCacheEntry<SubwayArrivalItem[]>>();

export class RealtimeTransitService {
  private dataGoKrKey: string;
  private seoulDataKey: string;
  private xmlParser: XMLParser;
  private gyeonggiStationCache = new Map<string, string>();

  constructor() {
    this.dataGoKrKey = process.env.DATA_GO_KR_API_KEY || "";
    this.seoulDataKey = process.env.SEOUL_OPENDATA_API_KEY || "";
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      isArray: (name) => {
        // itemList가 단일 항목일 때도 배열로 처리
        return name === "itemList";
      },
    });
  }

  /**
   * 버스 도착 정보 조회 (서울 → 경기도 순서로 시도)
   * @param stationId - 정류장 고유 ID (arsId 또는 mobileNo)
   * @param lineNames - 해당 구간의 노선명 배열 (서울/경기도 판별용)
   * @returns ArrivalInfo[] - 도착 정보 배열
   */
  async getBusArrival(
    stationId: string,
    lineNames?: string[],
    stationName?: string,
    preResolvedGyeonggiId?: string
  ): Promise<ArrivalInfo[]> {
    if (!this.dataGoKrKey) {
      console.error(
        "[RealtimeTransit] DATA_GO_KR_API_KEY가 설정되지 않았습니다."
      );
      return [];
    }

    // 방안 3: 정류장 단위 캐시 확인
    const cacheKey = `bus:${stationId}`;
    const now = Date.now();
    const cached = _busArrivalCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.data;

    // 서울 arsId는 "XX-XXX" 형태 (대시 포함), 경기도 mobileNo는 순수 숫자
    // 포맷으로 서울/경기 구분하여 불필요한 API 호출 방지
    const isSeoulFormat = stationId.includes("-");
    let result: ArrivalInfo[] = [];

    if (isSeoulFormat) {
      // 서울 API 시도
      const seoulArrivals = await this.getSeoulBusArrival(stationId);
      if (seoulArrivals.length > 0) {
        // lineNames가 있으면 매칭되는 노선이 있는지 확인
        if (lineNames && lineNames.length > 0) {
          const hasMatch = seoulArrivals.some((arrival) =>
            lineNames.some((name) =>
              arrival.lineName.toLowerCase() === name.toLowerCase()
            )
          );
          if (hasMatch) {
            result = seoulArrivals;
          }
          // 매칭 없음 → 경기도 시도 (result는 여전히 [])
        } else {
          result = seoulArrivals;
        }
      }
    }

    if (result.length === 0) {
      // 경기도 시도 (mobileNo → stationId 변환 후 조회)
      result = await this.getGyeonggiBusArrival(stationId, stationName, preResolvedGyeonggiId);
    }

    _busArrivalCache.set(cacheKey, { data: result, expiresAt: now + ARRIVAL_CACHE_TTL_MS });
    return result;
  }

  /**
   * 경기도 정류소 번호(mobileNo)로 내부 stationId를 조회
   * API: https://apis.data.go.kr/6410000/busstationservice/v2/getBusStationListv2
   */
  private async resolveGyeonggiStationId(
    mobileNo: string,
    stationName?: string
  ): Promise<string | null> {
    const cached = this.gyeonggiStationCache.get(mobileNo);
    if (cached) return cached;

    try {
      const params = new URLSearchParams({
        serviceKey: this.dataGoKrKey,
        keyword: mobileNo,
        format: "json",
      });

      const url = `https://apis.data.go.kr/6410000/busstationservice/v2/getBusStationListv2?${params.toString()}`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.warn(`[RealtimeTransit] 경기도 정류소 검색 HTTP 실패: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const { msgHeader, msgBody } = data.response;

      if (msgHeader.resultCode !== 0) {
        console.warn(`[RealtimeTransit] 경기도 정류소 검색 실패: resultCode=${msgHeader.resultCode}, message=${msgHeader.resultMessage}`);
        return null;
      }

      const items = msgBody?.busStationList;
      if (!items) return null;

      const itemArray = Array.isArray(items) ? items : [items];

      // mobileNo가 정확히 일치하는 정류소 찾기
      const mobileMatches = itemArray.filter(
        (item: { mobileNo: string | number }) =>
          String(item.mobileNo).trim() === mobileNo.trim()
      );

      let target: (typeof itemArray)[number] | null = null;

      if (mobileMatches.length === 1) {
        target = mobileMatches[0];
      } else if (mobileMatches.length > 1 && stationName) {
        // 동일 mobileNo 정류소가 여러 개인 경우 정류소 이름으로 비교
        const cleanName = stationName.replace(/\s/g, "");
        target = mobileMatches.find(
          (item: { stationName: string }) => {
            const apiName = String(item.stationName).replace(/\s/g, "");
            return apiName.includes(cleanName) || cleanName.includes(apiName);
          }
        ) ?? null;
        if (!target) {
          console.warn(
            `[RealtimeTransit] 경기도 정류소 이름 매칭 실패: mobileNo=${mobileNo}, stationName=${stationName}, 후보=${mobileMatches.map((m: { stationName: string }) => m.stationName).join(", ")}`
          );
        }
      } else if (mobileMatches.length === 0 && itemArray.length === 1) {
        target = itemArray[0];
      }

      if (target) {
        const stationId = String(target.stationId);
        this.gyeonggiStationCache.set(mobileNo, stationId);
        return stationId;
      }

      return null;
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `[RealtimeTransit] 경기도 정류소 조회 실패: ${error.message}`
        );
      }
      return null;
    }
  }

  /**
   * 서울 버스 도착 정보 조회
   * API: http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid
   * @param stationId - arsId (예: "13-123")
   */
  private async getSeoulBusArrival(stationId: string): Promise<ArrivalInfo[]> {
    try {
      // arsId 포맷 변환: "13-123" → "13123" (API는 대시 없는 5자리 숫자 형식)
      const arsId = stationId.replace(/-/g, "");
      const params = new URLSearchParams({
        serviceKey: this.dataGoKrKey,
        arsId,
      });

      const url = `http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid?${params.toString()}`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(
          `서울 버스 도착 정보 API 요청 실패: HTTP ${response.status}`
        );
      }

      const xmlText = await response.text();
      const parsed: BusArrivalResponse = this.xmlParser.parse(xmlText);

      const headerCd = parsed.ServiceResult?.msgHeader?.headerCd;
      if (headerCd && headerCd !== "0") {
        const headerMsg =
          parsed.ServiceResult?.msgHeader?.headerMsg || "알 수 없는 오류";
        console.warn(
          `[RealtimeTransit] 서울 버스 API 응답 에러: ${headerCd} - ${headerMsg}`
        );
        return [];
      }

      const items = parsed.ServiceResult?.msgBody?.itemList;
      if (!items) return [];

      const itemArray = Array.isArray(items) ? items : [items];
      const arrivals: ArrivalInfo[] = [];

      for (const item of itemArray) {
        const msg1 = item.arrmsg1 || "";
        const msg2 = item.arrmsg2 || "";
        const lineName = item.busRouteAbrv || item.rtNm || "";
        const direction = item.adirection || item.nxtStn || item.sectNm || "";
        const stationName = item.stNm || "";

        // 첫 번째 버스
        if (!msg1.includes("운행종료")) {
          arrivals.push({
            stationName,
            lineName,
            direction,
            arrivalTime:
              typeof item.traTime1 === "number" ? item.traTime1 : 0,
            arrivalMessage: msg1 || "정보 없음",
            remainingStops: item.rerideNum1 ?? undefined,
            vehicleType: "버스",
            isLastTrain: item.isLast1 === 1,
          });
        }

        // 두 번째 버스
        if (
          !msg2.includes("운행종료") &&
          msg2 !== "" &&
          msg2 !== "정보 없음"
        ) {
          arrivals.push({
            stationName,
            lineName,
            direction,
            arrivalTime:
              typeof item.traTime2 === "number" ? item.traTime2 : 0,
            arrivalMessage: msg2,
            remainingStops: item.rerideNum2 ?? undefined,
            vehicleType: "버스",
            isLastTrain: item.isLast2 === 1,
          });
        }
      }

      return arrivals;
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `[RealtimeTransit] 서울 버스 도착 정보 조회 실패: ${error.message}`
        );
      }
      return [];
    }
  }

  /**
   * 경기도 버스 도착 정보 조회
   * API: https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2
   */
  private async getGyeonggiBusArrival(
    mobileNo: string,
    stationName?: string,
    preResolvedStationId?: string
  ): Promise<ArrivalInfo[]> {
    try {
      // mobileNo → stationId 변환 (DB에 영속화된 값이 있으면 API 호출 생략)
      const stationId = preResolvedStationId
        ?? await this.resolveGyeonggiStationId(mobileNo, stationName);
      if (!stationId) return [];

      const params = new URLSearchParams({
        serviceKey: this.dataGoKrKey,
        stationId,
        format: "json",
      });

      const url = `https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2?${params.toString()}`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(
          `경기도 버스 도착 정보 API 요청 실패: HTTP ${response.status}`
        );
      }

      const data: GyeonggiBusArrivalResponse = await response.json();
      const { msgHeader, msgBody } = data.response;

      if (msgHeader.resultCode !== 0) {
        console.warn(
          `[RealtimeTransit] 경기도 버스 API 응답 에러: ${msgHeader.resultCode} - ${msgHeader.resultMessage}`
        );
        return [];
      }

      const items = msgBody?.busArrivalList;
      if (!items) return [];

      const itemArray = Array.isArray(items) ? items : [items];
      const arrivals: ArrivalInfo[] = [];

      for (const item of itemArray) {
        // 운행 종료 필터링 (PASS는 경유 정류장으로 정상 운행 상태)
        if (item.flag === "STOP") continue;

        // "마을2-1" → "2-1" (카카오맵 파서와 동일한 형식으로 통일)
        const lineName = String(item.routeName || "").replace(/^마을/, "");
        const predictTime1 =
          typeof item.predictTime1 === "number" ? item.predictTime1 : 0;
        const predictTime2 =
          typeof item.predictTime2 === "number" ? item.predictTime2 : 0;
        const predictSec1 =
          typeof item.predictTimeSec1 === "number"
            ? item.predictTimeSec1
            : predictTime1 * 60;
        const predictSec2 =
          typeof item.predictTimeSec2 === "number"
            ? item.predictTimeSec2
            : predictTime2 * 60;
        const loc1 =
          typeof item.locationNo1 === "number" ? item.locationNo1 : 0;
        const loc2 =
          typeof item.locationNo2 === "number" ? item.locationNo2 : 0;

        // 첫 번째 버스
        if (predictTime1 > 0) {
          arrivals.push({
            stationName: "",
            lineName,
            direction: "",
            arrivalTime: predictSec1,
            arrivalMessage: `${predictTime1}분 후`,
            remainingStops: loc1 > 0 ? loc1 : undefined,
            vehicleType: "버스",
            isLastTrain: false,
          });
        }

        // 두 번째 버스
        if (predictTime2 > 0) {
          arrivals.push({
            stationName: "",
            lineName,
            direction: "",
            arrivalTime: predictSec2,
            arrivalMessage: `${predictTime2}분 후`,
            remainingStops: loc2 > 0 ? loc2 : undefined,
            vehicleType: "버스",
            isLastTrain: false,
          });
        }
      }

      return arrivals;
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `[RealtimeTransit] 경기도 버스 도착 정보 조회 실패: ${error.message}`
        );
      }
      return [];
    }
  }

  /**
   * 서울 지하철 실시간 도착 정보를 원시(raw) 형태로 조회합니다. (방안 3 캐시 적용)
   * 방향 필터링 없이 해당 역의 모든 열차 정보를 반환합니다.
   * @param stationName - 역 이름 (예: "강남", "서울역")
   */
  private async getSubwayRawArrivals(stationName: string): Promise<SubwayArrivalItem[]> {
    if (!this.seoulDataKey) {
      console.error(
        "[RealtimeTransit] SEOUL_OPENDATA_API_KEY가 설정되지 않았습니다."
      );
      return [];
    }

    const cleanName = stationName.replace(/역$/, "");
    const cacheKey = `subway:${cleanName}`;
    const now = Date.now();
    const cached = _subwayRawCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.data;

    try {
      const url = `http://swopenAPI.seoul.go.kr/api/subway/${encodeURIComponent(this.seoulDataKey)}/json/realtimeStationArrival/0/10/${encodeURIComponent(cleanName)}`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(
          `지하철 도착 정보 API 요청 실패: HTTP ${response.status}`
        );
      }

      const data: SubwayArrivalResponse = await response.json();

      if (data.errorMessage && data.errorMessage.code !== "INFO-000") {
        const { code, message } = data.errorMessage;
        if (code === "INFO-200") {
          console.info(
            `[RealtimeTransit] 지하철 실시간 정보 없음 (운행 시간 외 가능): ${cleanName}`
          );
          return [];
        }
        console.warn(
          `[RealtimeTransit] 지하철 API 응답 에러: ${code} - ${message}`
        );
        return [];
      }

      const items = data.realtimeArrivalList ?? [];
      _subwayRawCache.set(cacheKey, { data: items, expiresAt: now + ARRIVAL_CACHE_TTL_MS });
      return items;
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `[RealtimeTransit] 지하철 도착 정보 조회 실패: ${error.message}`
        );
      } else {
        console.error(
          "[RealtimeTransit] 지하철 도착 정보 조회 중 알 수 없는 오류"
        );
      }
      return [];
    }
  }

  /**
   * SubwayArrivalItem[] 을 ArrivalInfo[] 로 변환합니다.
   * endStation 방향 필터링 → 도착 시간 정렬 → 최대 2대 슬라이싱 → 매핑 순서로 처리.
   */
  private filterSubwayArrivals(
    items: SubwayArrivalItem[],
    stationName: string,
    endStation?: string
  ): ArrivalInfo[] {
    const cleanName = stationName.replace(/역$/, "");
    let filtered = [...items];

    if (endStation && filtered.length > 0) {
      const cleanEnd = endStation.replace(/역$/, "");

      const filteredItems = filtered.filter((item) => {
        const trainTerminal = item.bstatnNm
          ?.replace(/역$/, "")
          .replace(/\s+/g, "")
          .trim();

        if (!trainTerminal) {
          // 종착역 정보 없음: 기존 방향 매칭 폴백
          const dir = determineSubwayDirection(item.subwayId, cleanName, cleanEnd);
          return dir ? item.updnLine === dir : false;
        }

        // 그래프 BFS로 열차가 목적지를 경유하는지 검증
        const reaches = willTrainReachStation(
          item.subwayId,
          cleanName,
          cleanEnd,
          trainTerminal,
          item.updnLine
        );

        if (reaches) return true;

        // 종착역이 그래프 데이터에 없는 경우: 방향 매칭 폴백
        if (!isStationKnown(item.subwayId, trainTerminal)) {
          const dir = determineSubwayDirection(item.subwayId, cleanName, cleanEnd);
          return dir ? item.updnLine === dir : false;
        }

        return false;
      });

      if (filteredItems.length > 0) {
        filtered = filteredItems;
      } else {
        // 방향을 판별할 수 없는 경우: 잘못된 방향 정보를 보여주는 것보다
        // 빈 결과를 반환하여 평균 배차 간격 기반 추정치를 사용하도록 함
        console.info(
          `[RealtimeTransit] 지하철 방향 판별 실패: ${cleanName} → ${cleanEnd}, 실시간 정보 생략`
        );
        return [];
      }
    }

    // 도착 시간 기준 정렬
    filtered.sort((a, b) => {
      const aTime = parseInt(a.barvlDt, 10) || 0;
      const bTime = parseInt(b.barvlDt, 10) || 0;
      if (aTime === 0 && bTime === 0) return 0;
      if (aTime === 0) return -1;
      if (bTime === 0) return 1;
      return aTime - bTime;
    });

    // 최대 2대까지만 표시
    filtered = filtered.slice(0, 2);

    return filtered.map((item) => {
      const arrivalSeconds = parseInt(item.barvlDt, 10) || 0;
      const direction = item.trainLineNm || item.updnLine || "";
      const lineName = item.subwayNm || this.getSubwayLineName(item.subwayId);
      const destination = item.bstatnNm?.replace(/역$/, "") || undefined;

      return {
        stationName: item.statnNm || cleanName,
        lineName,
        direction,
        arrivalTime: arrivalSeconds,
        arrivalMessage: (item.arvlMsg2 || item.arvlMsg3 || "정보 없음").replace(/\[(\d+)]/g, "$1"),
        remainingStops: undefined,
        vehicleType: item.btrainSttus || "지하철",
        isLastTrain: item.lstcarAt === "1",
        destination,
      };
    });
  }

  /**
   * 서울 지하철 실시간 도착 정보 조회
   * API: http://swopenAPI.seoul.go.kr/api/subway/{key}/json/realtimeStationArrival/0/10/{stationName}
   * @param stationName - 역 이름 (예: "강남", "서울역")
   * @returns ArrivalInfo[] - 도착 정보 배열
   */
  async getSubwayArrival(
    stationName: string,
    endStation?: string
  ): Promise<ArrivalInfo[]> {
    const items = await this.getSubwayRawArrivals(stationName);
    return this.filterSubwayArrivals(items, stationName, endStation);
  }

  /**
   * 경로의 모든 대중교통 Leg에 대한 도착 정보 조회
   * @param legs - 경로 구간 배열 (DB에서 조회한 RouteLeg 데이터)
   * @returns 각 대중교통 구간별 도착 정보 배열 (구간 순서 유지)
   */
  async getAllTransitArrivals(
    legs: Array<{
      id?: string | null;
      gyeonggiStationId?: string | null;
      type: string;
      startStation?: string | null;
      endStation?: string | null;
      startStationId?: string | null;
      lineNames?: string[];
    }>,
    options?: {
      onResolvedGyeonggiStation?: (legId: string, stationId: string) => void;
    }
  ): Promise<
    Array<{
      type: "bus" | "subway";
      arrivals: ArrivalInfo[];
      startStation?: string;
      endStation?: string;
    }>
  > {
    const transitLegs = legs.filter(
      (leg) => leg.type === "bus" || leg.type === "subway"
    );

    if (transitLegs.length === 0) {
      return [];
    }

    // 방안 5: 지하철 역별 raw 데이터 사전 조회 (동일 역 API 중복 제거)
    // 같은 역에서 여러 leg(다른 노선/방향)가 있어도 API 1회만 호출.
    const uniqueSubwayStations = new Set(
      transitLegs
        .filter((l) => l.type === "subway" && l.startStation)
        .map((l) => l.startStation!)
    );
    const subwayRawMap = new Map<string, SubwayArrivalItem[]>();
    await Promise.all(
      [...uniqueSubwayStations].map(async (station) => {
        subwayRawMap.set(station, await this.getSubwayRawArrivals(station));
      })
    );

    // 모든 대중교통 구간을 병렬로 조회
    const queries = transitLegs.map(async (leg) => {
      try {
        let arrivals: ArrivalInfo[] = [];

        if (leg.type === "bus") {
          if (!leg.startStationId) {
            console.warn(
              "[RealtimeTransit] 버스 도착 조회를 위한 정류장 ID가 없습니다."
            );
            return null;
          }

          // 경기도 버스: gyeonggiStationId가 DB에 있으면 resolve API 호출 생략
          const isSeoulFormat = leg.startStationId.includes("-");
          let preResolvedId: string | undefined = undefined;

          if (!isSeoulFormat) {
            if (leg.gyeonggiStationId) {
              preResolvedId = leg.gyeonggiStationId;
            } else {
              const resolved = await this.resolveGyeonggiStationId(
                leg.startStationId,
                leg.startStation ?? undefined
              );
              if (resolved) {
                preResolvedId = resolved;
                if (leg.id && options?.onResolvedGyeonggiStation) {
                  options.onResolvedGyeonggiStation(leg.id, resolved);
                }
              }
            }
          }

          arrivals = await this.getBusArrival(leg.startStationId, leg.lineNames, leg.startStation ?? undefined, preResolvedId);
        } else if (leg.type === "subway") {
          if (!leg.startStation) {
            console.warn(
              "[RealtimeTransit] 지하철 도착 조회를 위한 역 이름이 없습니다."
            );
            return null;
          }
          // 방안 5: 사전 조회된 raw 데이터에서 방향 필터링만 적용
          const rawItems = subwayRawMap.get(leg.startStation) ?? [];
          arrivals = this.filterSubwayArrivals(
            rawItems,
            leg.startStation,
            leg.endStation ?? undefined
          );
        }

        if (arrivals.length === 0) {
          return null;
        }

        // lineNames 배열로 필터링 (해당 노선들의 도착 정보만, 정확한 매칭)
        if (leg.lineNames && leg.lineNames.length > 0) {
          arrivals = arrivals.filter((arrival) =>
            leg.lineNames!.some((name) => {
              return arrival.lineName.toLowerCase() === name.toLowerCase();
            })
          );
        }

        if (arrivals.length === 0) {
          return null;
        }

        // 도착 시간 기준 오름차순 정렬 후 노선별 최대 2대
        arrivals.sort((a, b) => {
          if (a.arrivalTime === 0 && b.arrivalTime === 0) return 0;
          if (a.arrivalTime === 0) return -1;
          if (b.arrivalTime === 0) return 1;
          return a.arrivalTime - b.arrivalTime;
        });
        const perLineCount = new Map<string, number>();
        arrivals = arrivals.filter((a) => {
          const count = perLineCount.get(a.lineName) ?? 0;
          if (count >= 2) return false;
          perLineCount.set(a.lineName, count + 1);
          return true;
        });

        return {
          type: leg.type as "bus" | "subway",
          arrivals,
          startStation: leg.startStation ?? undefined,
          endStation: leg.endStation ?? undefined,
        };
      } catch (error) {
        if (error instanceof Error) {
          console.error(
            `[RealtimeTransit] ${leg.type} 도착 정보 조회 실패: ${error.message}`
          );
        }
        return null;
      }
    });

    const results = await Promise.all(queries);

    return results.filter(
      (r): r is NonNullable<(typeof results)[number]> => r !== null
    );
  }

  /**
   * 지하철 노선 ID를 노선명으로 변환
   * @param subwayId - 지하철 노선 코드
   * @returns 노선명 문자열
   */
  private getSubwayLineName(subwayId: string): string {
    const lineMap: Record<string, string> = {
      "1001": "1호선",
      "1002": "2호선",
      "1003": "3호선",
      "1004": "4호선",
      "1005": "5호선",
      "1006": "6호선",
      "1007": "7호선",
      "1008": "8호선",
      "1009": "9호선",
      "1063": "경의중앙선",
      "1065": "공항철도",
      "1067": "경춘선",
      "1075": "수인분당선",
      "1077": "신분당선",
      "1091": "자기부상",
      "1092": "우이신설경전철",
      "1093": "서해선",
      "1081": "경강선",
      "1094": "신림선",
      "1032": "GTX-A",
      "1071": "인천1호선",
    };
    return lineMap[subwayId] || `노선 ${subwayId}`;
  }
}
