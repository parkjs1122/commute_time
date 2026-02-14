/** 현재 한국 시간(KST)의 시(hour)를 반환합니다 (UTC+9 오프셋 방식) */
export function getKoreaHour(date: Date = new Date()): number {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60_000;
  const koreaMs = utcMs + 9 * 60 * 60_000;
  return new Date(koreaMs).getHours();
}

/** 현재 한국 시간이 운행 시간 외(새벽 1시~5시)인지 확인합니다 */
export function isOffHours(date: Date = new Date()): boolean {
  const hour = getKoreaHour(date);
  return hour >= 1 && hour < 5;
}
