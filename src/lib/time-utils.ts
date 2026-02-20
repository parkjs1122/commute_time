/** 주어진 시각을 한국 시간(KST) Date로 변환합니다 (UTC+9 오프셋 방식) */
export function toKoreaDate(date: Date = new Date()): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60_000;
  const koreaMs = utcMs + 9 * 60 * 60_000;
  return new Date(koreaMs);
}

/** 현재 한국 시간(KST)의 시(hour)를 반환합니다 (UTC+9 오프셋 방식) */
export function getKoreaHour(date: Date = new Date()): number {
  return toKoreaDate(date).getHours();
}

/** 현재 한국 시간이 운행 시간 외(새벽 1시~5시)인지 확인합니다 */
export function isOffHours(date: Date = new Date()): boolean {
  const hour = getKoreaHour(date);
  return hour >= 1 && hour < 5;
}

/** 한국 시간(KST) 기준 날짜를 YYYYMMDD 형식으로 반환합니다 */
export function getKoreaDateString(date: Date = new Date()): string {
  const kst = toKoreaDate(date);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** 한국 시간(KST) 기준 시각을 HHmm 형식으로 반환합니다 */
export function getKoreaTimeString(date: Date = new Date()): string {
  const kst = toKoreaDate(date);
  const h = String(kst.getHours()).padStart(2, "0");
  const m = String(kst.getMinutes()).padStart(2, "0");
  return `${h}${m}`;
}
