/**
 * 간단한 인메모리 레이트 리미터
 *
 * 외부 API 호출 시 Rate Limit 초과를 방지하기 위해
 * 슬라이딩 윈도우 방식으로 요청 횟수를 제한합니다.
 *
 * 참고: 인메모리이므로 서버 재시작/다중 인스턴스 환경에서는
 * 초기화됩니다. 프로덕션에서는 Redis 등으로 대체를 권장합니다.
 */
export class RateLimiter {
  private timestamps: Map<string, number[]> = new Map();

  /**
   * @param maxRequests 윈도우 내 최대 요청 수
   * @param windowMs   슬라이딩 윈도우 크기(밀리초)
   */
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  /**
   * 주어진 키에 대해 요청 가능 여부를 확인합니다.
   * 만료된 타임스탬프를 정리한 뒤 현재 윈도우 내 요청 수를 확인합니다.
   */
  canMakeRequest(key: string): boolean {
    this.cleanup(key);
    const timestamps = this.timestamps.get(key) || [];
    return timestamps.length < this.maxRequests;
  }

  /**
   * 요청 실행을 기록합니다.
   * canMakeRequest()로 확인 후 호출해야 합니다.
   */
  recordRequest(key: string): void {
    const timestamps = this.timestamps.get(key) || [];
    timestamps.push(Date.now());
    this.timestamps.set(key, timestamps);
  }

  /**
   * 요청 가능 여부를 확인하고, 가능하면 기록까지 수행합니다.
   * @returns true이면 요청이 허용되었음을 의미합니다.
   */
  tryRequest(key: string): boolean {
    if (!this.canMakeRequest(key)) {
      return false;
    }
    this.recordRequest(key);
    return true;
  }

  /**
   * 다음 요청이 가능해지기까지 남은 시간(밀리초)을 반환합니다.
   * 즉시 가능한 경우 0을 반환합니다.
   */
  getRetryAfterMs(key: string): number {
    this.cleanup(key);
    const timestamps = this.timestamps.get(key) || [];

    if (timestamps.length < this.maxRequests) {
      return 0;
    }

    // 가장 오래된 타임스탬프가 윈도우 밖으로 나갈 때까지의 시간
    const oldest = timestamps[0];
    const retryAfter = oldest + this.windowMs - Date.now();
    return Math.max(0, retryAfter);
  }

  /**
   * 윈도우 밖의 만료된 타임스탬프를 제거합니다.
   */
  private cleanup(key: string): void {
    const timestamps = this.timestamps.get(key);
    if (!timestamps) return;

    const cutoff = Date.now() - this.windowMs;
    const filtered = timestamps.filter((ts) => ts > cutoff);

    if (filtered.length === 0) {
      this.timestamps.delete(key);
    } else {
      this.timestamps.set(key, filtered);
    }
  }

  /**
   * 특정 키의 기록을 초기화합니다.
   */
  reset(key: string): void {
    this.timestamps.delete(key);
  }

  /**
   * 모든 기록을 초기화합니다.
   */
  resetAll(): void {
    this.timestamps.clear();
  }
}

// ── 사전 구성된 레이트 리미터 인스턴스 ──

/** 카카오 지도 파싱 - 분당 5회 */
export const kakaoMapParserLimiter = new RateLimiter(5, 60_000);

/** 카카오 로컬 API - 분당 30회 */
export const kakaoLocalApiLimiter = new RateLimiter(30, 60_000);

/** 공공데이터포털 API (버스/지하철 실시간 정보) - 분당 60회 */
export const publicDataApiLimiter = new RateLimiter(60, 60_000);
