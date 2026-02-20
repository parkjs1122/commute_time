/**
 * (main) 라우트 그룹 로딩 스켈레톤
 *
 * 대시보드 페이지가 로드되는 동안 표시되는 shimmer 스켈레톤 UI입니다.
 */
export default function MainLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* 헤더: 제목 + 갱신 인디케이터 */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 rounded-md bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-2">
          <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-7 w-7 rounded-md bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      {/* 기본 ETA 카드 스켈레톤 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-700 dark:bg-gray-800">
        {/* 별칭 + 뱃지 */}
        <div className="mb-4 flex items-center gap-2">
          <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-5 w-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        {/* ETA 시간 (큰 텍스트) */}
        <div className="h-10 w-64 rounded bg-gray-200 sm:h-12 sm:w-80 dark:bg-gray-700" />
        {/* 교통수단 뱃지 */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-28 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
        {/* 요약 정보 */}
        <div className="mt-5 flex items-center gap-4">
          <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      {/* 추가 경로 섹션 */}
      <div className="space-y-3">
        <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="h-3 w-36 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="h-6 w-14 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
