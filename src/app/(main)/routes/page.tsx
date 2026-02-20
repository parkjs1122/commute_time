"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import LegDetail from "@/components/LegDetail";
import Spinner from "@/components/Spinner";

interface RouteLegData {
  id: string;
  type: string;
  lineNames: string[];
  lineColor: string | null;
  startStation: string | null;
  endStation: string | null;
  sectionTime: number;
}

interface SavedRouteData {
  id: string;
  alias: string;
  isDefault: boolean;
  routeType: string;
  originName: string;
  destName: string;
  totalTime: number;
  transferCount: number;
  fare: number | null;
  legs: RouteLegData[];
}

const ROUTE_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  commute: {
    label: "출근",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  return: {
    label: "퇴근",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  other: {
    label: "기타",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  },
};

/**
 * 저장된 경로 카드 컴포넌트
 */
function RouteCard({
  route,
  onEditAlias,
  onDelete,
  onSetDefault,
  onError,
}: {
  route: SavedRouteData;
  onEditAlias: (id: string, currentAlias: string) => void;
  onDelete: (id: string, alias: string) => void;
  onSetDefault: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAlias, setEditAlias] = useState(route.alias);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveAlias() {
    if (!editAlias.trim() || editAlias.trim() === route.alias) {
      setIsEditing(false);
      setEditAlias(route.alias);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/routes/${route.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: editAlias.trim() }),
      });

      if (response.ok) {
        onEditAlias(route.id, editAlias.trim());
        setIsEditing(false);
      } else {
        const data = await response.json();
        onError(data?.error?.message || "별칭 수정에 실패했습니다.");
      }
    } catch {
      onError("별칭 수정 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSaveAlias();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditAlias(route.alias);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* 헤더: 별칭 + 기본 경로 뱃지 */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editAlias}
                onChange={(e) => setEditAlias(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveAlias}
                disabled={isSaving}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                autoFocus
              />
            </div>
          ) : (
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
              {route.alias}
            </h3>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {ROUTE_TYPE_BADGE[route.routeType] && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROUTE_TYPE_BADGE[route.routeType].className}`}>
              {ROUTE_TYPE_BADGE[route.routeType].label}
            </span>
          )}
          {route.isDefault && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              기본
            </span>
          )}
        </div>
      </div>

      {/* 출발지 -> 목적지 */}
      <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
        <span className="font-medium">{route.originName}</span>
        <span className="mx-1.5 text-gray-400">→</span>
        <span className="font-medium">{route.destName}</span>
      </p>

      {/* 경로 요약 */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {route.totalTime}분
        </span>
        <span>환승 {route.transferCount}회</span>
        {route.fare != null && (
          <span>{route.fare.toLocaleString()}원</span>
        )}
      </div>

      {/* 구간 뱃지 */}
      <div className="mb-4">
        <LegDetail legs={route.legs} />
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
        <button
          onClick={() => {
            setIsEditing(true);
            setEditAlias(route.alias);
          }}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          이름 수정
        </button>
        {!route.isDefault && (
          <button
            onClick={() => onSetDefault(route.id)}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            기본 설정
          </button>
        )}
        <button
          onClick={() => onDelete(route.id, route.alias)}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

/**
 * 삭제 확인 다이얼로그
 */
function DeleteConfirmDialog({
  isOpen,
  alias,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  alias: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          경로 삭제
        </h3>
        <p className="mb-5 text-sm text-gray-600 dark:text-gray-300">
          &quot;{alias}&quot; 경로를 삭제하시겠습니까? 이 작업은 되돌릴 수
          없습니다.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<SavedRouteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 삭제 다이얼로그 상태
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    alias: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchRoutes = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/routes");

      if (!response.ok) {
        throw new Error("경로 목록을 불러오는 데 실패했습니다.");
      }

      const data: SavedRouteData[] = await response.json();
      setRoutes(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "경로 목록을 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  function handleEditAlias(id: string, newAlias: string) {
    setRoutes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, alias: newAlias } : r))
    );
  }

  function handleDeleteClick(id: string, alias: string) {
    setDeleteTarget({ id, alias });
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/routes/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRoutes((prev) =>
          prev.filter((r) => r.id !== deleteTarget.id)
        );
        setDeleteTarget(null);
      } else {
        const data = await response.json();
        setActionError(data?.error?.message || "삭제에 실패했습니다.");
      }
    } catch {
      setActionError("삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      const response = await fetch(`/api/routes/${id}/default`, {
        method: "PATCH",
      });

      if (response.ok) {
        setRoutes((prev) =>
          prev.map((r) => ({
            ...r,
            isDefault: r.id === id,
          }))
        );
      } else {
        const data = await response.json();
        setActionError(data?.error?.message || "기본 경로 설정에 실패했습니다.");
      }
    } catch {
      setActionError("기본 경로 설정 중 오류가 발생했습니다.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
        <button
          onClick={fetchRoutes}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            경로 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {routes.length}/5개 경로
          </p>
        </div>
        {routes.length < 5 && (
          <Link
            href="/routes/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            경로 추가
          </Link>
        )}
      </div>

      {/* 액션 에러 */}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-700 dark:text-red-400">
              {actionError}
            </p>
            <button
              onClick={() => setActionError(null)}
              className="ml-4 text-sm font-medium text-red-700 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 경로 목록 */}
      {routes.length > 0 ? (
        <div className="space-y-3">
          {routes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              onEditAlias={handleEditAlias}
              onDelete={handleDeleteClick}
              onSetDefault={handleSetDefault}
              onError={setActionError}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
            />
          </svg>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            저장된 경로가 없습니다
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            경로를 추가해주세요
          </p>
          <Link
            href="/routes/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            경로 추가
          </Link>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        alias={deleteTarget?.alias || ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />
    </div>
  );
}
