import { prisma } from "@/lib/prisma";
import { getKoreaDateString, getKoreaTimeString, toKoreaDate } from "@/lib/time-utils";

/** 시외버스 API 도시 코드 목록 */
const CITY_CODES = [
  { cityCode: "11", cityName: "서울특별시" },
  { cityCode: "12", cityName: "세종특별시" },
  { cityCode: "21", cityName: "부산광역시" },
  { cityCode: "22", cityName: "대구광역시" },
  { cityCode: "23", cityName: "인천광역시" },
  { cityCode: "24", cityName: "광주광역시" },
  { cityCode: "25", cityName: "대전광역시" },
  { cityCode: "26", cityName: "울산광역시" },
  { cityCode: "31", cityName: "경기도" },
  { cityCode: "32", cityName: "강원도" },
  { cityCode: "33", cityName: "충청북도" },
  { cityCode: "34", cityName: "충청남도" },
  { cityCode: "35", cityName: "전라북도" },
  { cityCode: "36", cityName: "전라남도" },
  { cityCode: "37", cityName: "경상북도" },
  { cityCode: "38", cityName: "경상남도" },
  { cityCode: "39", cityName: "제주도" },
] as const;

/** 터미널 이름 정규화 시 제거할 접미사 */
const TERMINAL_SUFFIXES = [
  "종합버스터미널",
  "종합터미널",
  "시외버스터미널",
  "고속버스터미널",
  "버스터미널",
  "시외터미널",
  "고속터미널",
  "터미널",
  "공용버스정류장",
  "시외",
  "고속",
];

/** 시외버스 시간표 API 응답 아이템 */
interface ScheduleItem {
  depPlaceNm: string;
  arrPlaceNm: string;
  depPlandTime: number; // YYYYMMDDHHmm (숫자)
  arrPlandTime: number;
  charge: number;
  gradeNm: string;
  routeId: string;
}

/** 파싱된 시간표 정보 */
interface ParsedSchedule {
  depPlaceNm: string;
  arrPlaceNm: string;
  depTime: string; // "HH:mm"
  arrTime: string; // "HH:mm"
  depTimeRaw: string; // "HHmm"
  charge: number;
  gradeNm: string;
}

/** 다음 출발 정보 (대시보드 표시용) */
export interface IntercityDeparture {
  departureTime: string; // "HH:mm" KST
  arrivalTime: string; // "HH:mm" KST
  waitMinutes: number; // 출발까지 남은 시간 (분)
  gradeNm: string;
  charge: number;
}

/** 인메모리 캐시 엔트리 */
interface ScheduleCacheEntry {
  schedules: ParsedSchedule[];
  dateKey: string; // YYYYMMDD
}

/** 인메모리 터미널 데이터 */
interface TerminalData {
  terminalId: string;
  terminalNm: string;
  normalizedNm: string;
}

// ── 모듈 레벨 싱글턴 상태 (서버 프로세스 수명 동안 유지) ──

/** 터미널 동기화 상태 */
let syncState: "idle" | "syncing" | "done" = "idle";
let syncPromise: Promise<void> | null = null;

/** 인메모리 터미널 목록 (DB 조회 대신 사용) */
let terminalList: TerminalData[] = [];

/** 터미널 이름 → terminalId 캐시 */
const terminalNameCache = new Map<string, string | null>();

/** 시간표 캐시: "depTerminalId:arrTerminalId:YYYYMMDD" → 시간표 */
const scheduleCache = new Map<string, ScheduleCacheEntry>();

/**
 * 터미널 이름에서 접미사를 제거하여 정규화합니다.
 */
function normalizeTerminalName(name: string): string {
  let normalized = name.replace(/\s+/g, "");
  for (const suffix of TERMINAL_SUFFIXES) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }
  return normalized;
}

export class IntercityBusService {
  private dataGoKrKey: string;

  constructor() {
    this.dataGoKrKey = process.env.DATA_GO_KR_API_KEY || "";
  }

  /**
   * 터미널 데이터를 로드합니다 (한 번만 실행, 동시 호출 방지).
   * DB에 데이터가 없으면 API에서 동기화 후 메모리에 로드합니다.
   */
  private async ensureTerminalsLoaded(): Promise<void> {
    if (syncState === "done" && terminalList.length > 0) return;

    if (syncState === "syncing" && syncPromise) {
      await syncPromise;
      return;
    }

    syncState = "syncing";
    syncPromise = this.loadTerminals();

    try {
      await syncPromise;
      syncState = "done";
    } catch {
      syncState = "idle";
      syncPromise = null;
    }
  }

  private async loadTerminals(): Promise<void> {
    // DB에서 먼저 로드 시도
    const existing = await prisma.busTerminal.findMany();
    if (existing.length > 0) {
      terminalList = existing.map((t) => ({
        terminalId: t.terminalId,
        terminalNm: t.terminalNm,
        normalizedNm: normalizeTerminalName(t.terminalNm),
      }));
      return;
    }

    // DB가 비어있으면 API에서 동기화 (17개 도시 병렬 호출)
    console.log("[IntercityBus] 터미널 데이터 동기화 시작...");

    const results = await Promise.allSettled(
      CITY_CODES.map((city) =>
        this.fetchTerminals(city.cityCode, city.cityName)
      )
    );

    const allTerminals: Array<{
      terminalId: string;
      terminalNm: string;
      cityCode: string;
      cityName: string;
    }> = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        allTerminals.push(...result.value);
      }
    }

    if (allTerminals.length === 0) {
      console.warn("[IntercityBus] 터미널 데이터를 가져오지 못했습니다.");
      return;
    }

    // DB에 일괄 저장 (createMany로 빠르게)
    await prisma.busTerminal.createMany({
      data: allTerminals,
      skipDuplicates: true,
    });

    terminalList = allTerminals.map((t) => ({
      terminalId: t.terminalId,
      terminalNm: t.terminalNm,
      normalizedNm: normalizeTerminalName(t.terminalNm),
    }));

    console.log(
      `[IntercityBus] 터미널 동기화 완료: ${terminalList.length}개`
    );
  }

  /**
   * 특정 도시의 터미널 목록을 API에서 가져옵니다 (DB 저장 없이 반환만).
   */
  private async fetchTerminals(
    cityCode: string,
    cityName: string
  ): Promise<
    Array<{
      terminalId: string;
      terminalNm: string;
      cityCode: string;
      cityName: string;
    }>
  > {
    const params = new URLSearchParams({
      serviceKey: this.dataGoKrKey,
      cityCode,
      _type: "json",
      numOfRows: "200",
    });

    const url = `http://apis.data.go.kr/1613000/SuburbsBusInfoService/getSuberbsBusTrminlList?${params.toString()}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for cityCode=${cityCode}`);
    }

    const data = await response.json();
    const items = data?.response?.body?.items?.item;

    if (!items) return [];

    const itemArray = Array.isArray(items) ? items : [items];

    return itemArray.map(
      (item: { terminalId: string; terminalNm: string; cityName?: string }) => ({
        terminalId: item.terminalId,
        terminalNm: item.terminalNm,
        cityCode,
        cityName: item.cityName || cityName,
      })
    );
  }

  /**
   * 터미널 이름으로 terminalId를 조회합니다 (인메모리 퍼지 매칭).
   */
  async findTerminalByName(name: string): Promise<string | null> {
    if (!name) return null;

    // 캐시 확인
    const cached = terminalNameCache.get(name);
    if (cached !== undefined) return cached;

    // 터미널 데이터 로드 확인
    await this.ensureTerminalsLoaded();

    const cleanName = normalizeTerminalName(name);
    let found: TerminalData | undefined;

    // 1) 정확히 일치
    found = terminalList.find((t) => t.terminalNm === name);

    // 2) terminalNm에 name이 포함
    if (!found) {
      found = terminalList.find((t) => t.terminalNm.includes(name));
    }

    // 3) name에 terminalNm이 포함
    if (!found) {
      found = terminalList.find((t) => name.includes(t.terminalNm));
    }

    // 4) 정규화된 이름 정확히 일치
    if (!found) {
      found = terminalList.find((t) => t.normalizedNm === cleanName);
    }

    // 5) 정규화된 이름 포함 관계
    if (!found) {
      found = terminalList.find(
        (t) =>
          t.normalizedNm.includes(cleanName) ||
          cleanName.includes(t.normalizedNm)
      );
    }

    const terminalId = found?.terminalId ?? null;
    terminalNameCache.set(name, terminalId);

    if (!terminalId) {
      console.warn(`[IntercityBus] 터미널 매칭 실패: "${name}"`);
    }

    return terminalId;
  }

  /**
   * 시외버스 시간표를 API에서 조회합니다 (인메모리 캐시 사용).
   */
  async getSchedules(
    depTerminalId: string,
    arrTerminalId: string,
    date: Date = new Date()
  ): Promise<ParsedSchedule[]> {
    const dateKey = getKoreaDateString(date);
    const cacheKey = `${depTerminalId}:${arrTerminalId}:${dateKey}`;

    // 캐시 확인
    const cached = scheduleCache.get(cacheKey);
    if (cached && cached.dateKey === dateKey) {
      return cached.schedules;
    }

    // 오래된 캐시 정리
    for (const [key, entry] of scheduleCache) {
      if (entry.dateKey !== dateKey) {
        scheduleCache.delete(key);
      }
    }

    try {
      const params = new URLSearchParams({
        serviceKey: this.dataGoKrKey,
        depTerminalId,
        arrTerminalId,
        depPlandTime: dateKey,
        _type: "json",
        numOfRows: "200",
      });

      const url = `http://apis.data.go.kr/1613000/SuburbsBusInfoService/getStrtpntAlocFndSuberbsBusInfo?${params.toString()}`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.error(
          `[IntercityBus] 시간표 API HTTP 실패: ${response.status}`
        );
        return [];
      }

      const data = await response.json();
      const items = data?.response?.body?.items?.item;

      if (!items) {
        // 빈 결과 캐시 (불필요한 재호출 방지)
        scheduleCache.set(cacheKey, { schedules: [], dateKey });
        return [];
      }

      const itemArray: ScheduleItem[] = Array.isArray(items)
        ? items
        : [items];

      const schedules: ParsedSchedule[] = itemArray
        .map((item) => {
          const depTimeStr = String(item.depPlandTime);
          const arrTimeStr = String(item.arrPlandTime);
          const depHH = depTimeStr.slice(8, 10);
          const depMM = depTimeStr.slice(10, 12);
          const arrHH = arrTimeStr.slice(8, 10);
          const arrMM = arrTimeStr.slice(10, 12);

          return {
            depPlaceNm: item.depPlaceNm,
            arrPlaceNm: item.arrPlaceNm,
            depTime: `${depHH}:${depMM}`,
            arrTime: `${arrHH}:${arrMM}`,
            depTimeRaw: `${depHH}${depMM}`,
            charge: item.charge,
            gradeNm: item.gradeNm,
          };
        })
        .sort((a, b) => a.depTimeRaw.localeCompare(b.depTimeRaw));

      scheduleCache.set(cacheKey, { schedules, dateKey });

      return schedules;
    } catch (error) {
      console.error(
        `[IntercityBus] 시간표 조회 실패:`,
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  /**
   * 현재 시간 이후 다음 N개의 출발 정보를 반환합니다.
   *
   * @param startStation - 출발 터미널 이름 (예: "동서울")
   * @param endStation - 도착 터미널 이름 (예: "인천")
   * @param count - 최대 반환 개수 (기본 2)
   */
  async getUpcomingDepartures(
    startStation: string,
    endStation: string,
    count: number = 2
  ): Promise<IntercityDeparture[]> {
    // 터미널 이름 → ID 변환
    const [depTerminalId, arrTerminalId] = await Promise.all([
      this.findTerminalByName(startStation),
      this.findTerminalByName(endStation),
    ]);

    if (!depTerminalId || !arrTerminalId) {
      return [];
    }

    const now = new Date();
    const schedules = await this.getSchedules(depTerminalId, arrTerminalId, now);

    if (schedules.length === 0) {
      return [];
    }

    // 현재 KST 시각 이후의 배차만 필터
    const currentTimeStr = getKoreaTimeString(now);
    const kst = toKoreaDate(now);
    const currentMinutes = kst.getHours() * 60 + kst.getMinutes();

    const upcoming: IntercityDeparture[] = [];

    for (const schedule of schedules) {
      if (schedule.depTimeRaw <= currentTimeStr) continue;

      const depHour = parseInt(schedule.depTimeRaw.slice(0, 2), 10);
      const depMin = parseInt(schedule.depTimeRaw.slice(2, 4), 10);
      const depMinutes = depHour * 60 + depMin;
      const waitMinutes = depMinutes - currentMinutes;

      upcoming.push({
        departureTime: schedule.depTime,
        arrivalTime: schedule.arrTime,
        waitMinutes,
        gradeNm: schedule.gradeNm,
        charge: schedule.charge,
      });

      if (upcoming.length >= count) break;
    }

    return upcoming;
  }
}
