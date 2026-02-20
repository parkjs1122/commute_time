"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

/**
 * 전역 에러 바운더리 페이지
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError] 처리되지 않은 오류:", error);
  }, [error]);

  return (
    <ErrorState
      fullScreen
      onRetry={reset}
      showHomeLink
    />
  );
}
