/**
 * 경로 관리 페이지 로딩 스켈레톤
 *
 * /routes 페이지가 로드되는 동안 표시되는 shimmer 스켈레톤 UI입니다.
 */
export default function RoutesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 헤더 스켈레톤 */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-24 rounded-md bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="h-9 w-24 rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* 경로 카드 스켈레톤 */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            {/* 헤더: 별칭 + 뱃지 */}
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
              {i === 1 && (
                <div className="h-5 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
              )}
            </div>

            {/* 출발지 -> 목적지 */}
            <div className="mb-2 flex items-center gap-2">
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-3 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* 요약 정보 */}
            <div className="mb-3 flex items-center gap-3">
              <div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-14 rounded bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* 구간 뱃지 */}
            <div className="mb-4 flex items-center gap-1">
              <div className="h-5 w-14 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
              <div className="h-7 w-16 rounded-md bg-gray-200 dark:bg-gray-700" />
              {i !== 1 && (
                <div className="h-7 w-16 rounded-md bg-gray-200 dark:bg-gray-700" />
              )}
              <div className="h-7 w-10 rounded-md bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
