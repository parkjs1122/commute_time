"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

/**
 * (main) 라우트 그룹 에러 바운더리 페이지
 *
 * 메인 레이아웃(NavBar 포함) 내부에서 발생한 에러를 잡아
 * 네비게이션은 유지한 채 에러 메시지를 표시합니다.
 */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MainError] 메인 영역 오류:", error);
  }, [error]);

  return (
    <ErrorState
      title="문제가 발생했습니다"
      message="페이지를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요."
      onRetry={reset}
      showHomeLink
    />
  );
}
