"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LegDetail from "@/components/LegDetail";
import RouteSourceBadge from "@/components/RouteSourceBadge";
import RouteTypeBadge from "@/components/RouteTypeBadge";
import Spinner from "@/components/Spinner";
import Dialog from "@/components/Dialog";
import ErrorBanner from "@/components/ErrorBanner";
import { useToast } from "@/components/ToastProvider";

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
  routeSource: string | null;
  memo: string | null;
  originName: string;
  originLat: number;
  originLng: number;
  destName: string;
  destLat: number;
  destLng: number;
  totalTime: number;
  transferCount: number;
  fare: number | null;
  legs: RouteLegData[];
}

const ROUTE_TYPE_OPTIONS = [
  { value: "commute", label: "출근" },
  { value: "return", label: "퇴근" },
  { value: "other", label: "기타" },
] as const;

/**
 * 경로 타입 선택 (세그먼트 버튼)
 */
function RouteTypeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600">
      {ROUTE_TYPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-2.5 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
            value === option.value
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 메모 편집 컴포넌트
 */
function MemoEditor({
  routeId,
  initialMemo,
  onSaved,
}: {
  routeId: string;
  initialMemo: string | null;
  onSaved: (memo: string | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [memo, setMemo] = useState(initialMemo ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    const trimmed = memo.trim();
    setIsSaving(true);
    try {
      const response = await fetch(`/api/routes/${routeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: trimmed || null }),
      });
      if (response.ok) {
        onSaved(trimmed || null);
        setIsEditing(false);
      }
    } catch {
      // silently fail
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <button
        onClick={() => { setIsEditing(true); setMemo(initialMemo ?? ""); }}
        title={initialMemo ? "메모 수정" : "메모 추가"}
        className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setIsEditing(false); }}
        placeholder="메모를 입력하세요 (예: 2번 출구가 빠름)"
        maxLength={200}
        disabled={isSaving}
        className="flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        autoFocus
      />
      <button onClick={handleSave} disabled={isSaving}
        className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        저장
      </button>
      <button onClick={() => setIsEditing(false)} disabled={isSaving}
        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
        취소
      </button>
    </div>
  );
}

/**
 * 저장된 경로 카드 컴포넌트
 */
function RouteCard({
  route,
  onEditAlias,
  onDelete,
  onChangeRouteType,
  onChangeMemo,
  onError,
  routeCount,
}: {
  route: SavedRouteData;
  onEditAlias: (id: string, currentAlias: string) => void;
  onDelete: (id: string, alias: string) => void;
  onChangeRouteType: (id: string, routeType: string) => void;
  onChangeMemo: (id: string, memo: string | null) => void;
  onError: (message: string) => void;
  routeCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editAlias, setEditAlias] = useState(route.alias);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingReverse, setIsCreatingReverse] = useState(false);

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
    if (e.key === "Enter") handleSaveAlias();
    else if (e.key === "Escape") { setIsEditing(false); setEditAlias(route.alias); }
  }

  async function handleCreateReverse() {
    if (routeCount >= 5) {
      toast("error", "최대 5개의 경로만 저장할 수 있습니다.");
      return;
    }

    setIsCreatingReverse(true);
    try {
      // Search for reverse route
      const searchRes = await fetch("/api/routes/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { name: route.destName, lat: route.destLat, lng: route.destLng },
          destination: { name: route.originName, lat: route.originLat, lng: route.originLng },
        }),
      });

      if (!searchRes.ok) throw new Error("역방향 경로 탐색에 실패했습니다.");

      const routes = await searchRes.json();
      if (routes.length === 0) {
        toast("error", "역방향 경로를 찾을 수 없습니다.");
        return;
      }

      // Save first route result
      const reverseType = route.routeType === "commute" ? "return" : route.routeType === "return" ? "commute" : "other";
      const reverseAlias = `${route.destName} → ${route.originName}`;

      const saveRes = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: reverseAlias,
          origin: { id: "", name: route.destName, address: "", roadAddress: "", latitude: route.destLat, longitude: route.destLng, category: "" },
          destination: { id: "", name: route.originName, address: "", roadAddress: "", latitude: route.originLat, longitude: route.originLng, category: "" },
          route: routes[0],
          routeType: reverseType,
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data?.error?.message || "역방향 경로 저장에 실패했습니다.");
      }

      toast("success", "역방향 경로가 저장되었습니다.");
      router.refresh();
      window.location.reload();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "역방향 경로 생성에 실패했습니다.");
    } finally {
      setIsCreatingReverse(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* 헤더: 별칭 + 뱃지 */}
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
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
          <RouteSourceBadge routeSource={route.routeSource} />
          <RouteTypeBadge routeType={route.routeType} />
        </div>
      </div>

      {/* 출발지 -> 목적지 */}
      <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
        <span className="font-medium">{route.originName}</span>
        <span className="mx-1.5 text-gray-400">&rarr;</span>
        <span className="font-medium">{route.destName}</span>
      </p>

      {/* 메모 */}
      {route.memo && (
        <div className="mb-2 flex items-start gap-1.5 rounded-md bg-yellow-50 px-2.5 py-1.5 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          <svg className="mt-0.5 h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          <span>{route.memo}</span>
        </div>
      )}

      {/* 경로 요약 */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span className="font-medium text-gray-900 dark:text-gray-100">{route.totalTime}분</span>
        <span>환승 {route.transferCount}회</span>
        {route.fare != null && <span>{route.fare.toLocaleString()}원</span>}
      </div>

      {/* 구간 뱃지 */}
      <div className="mb-4">
        <LegDetail legs={route.legs} />
      </div>

      {/* 액션 영역 */}
      <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
        {/* Row 1: 속성 & 편집 */}
        <div className="flex items-center justify-between">
          <RouteTypeSelector value={route.routeType} onChange={(type) => onChangeRouteType(route.id, type)} />
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setIsEditing(true); setEditAlias(route.alias); }}
              title="이름 수정"
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>
            <MemoEditor routeId={route.id} initialMemo={route.memo} onSaved={(memo) => onChangeMemo(route.id, memo)} />
          </div>
        </div>
        {/* Row 2: 역방향 생성 & 삭제 */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleCreateReverse}
            disabled={isCreatingReverse || routeCount >= 5}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            {isCreatingReverse ? (
              <span className="inline-flex items-center gap-1">
                <Spinner className="h-3 w-3" /> 생성 중...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                역방향 생성
              </span>
            )}
          </button>
          <button
            onClick={() => onDelete(route.id, route.alias)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoutesPage() {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<SavedRouteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 삭제 다이얼로그 상태
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; alias: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchRoutes = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/routes");
      if (!response.ok) throw new Error("경로 목록을 불러오는 데 실패했습니다.");
      const data: SavedRouteData[] = await response.json();
      setRoutes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "경로 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  function handleEditAlias(id: string, newAlias: string) {
    setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, alias: newAlias } : r)));
    toast("success", "경로 이름이 변경되었습니다.");
  }

  function handleChangeMemo(id: string, memo: string | null) {
    setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, memo } : r)));
    toast("success", memo ? "메모가 저장되었습니다." : "메모가 삭제되었습니다.");
  }

  function handleDeleteClick(id: string, alias: string) {
    setDeleteTarget({ id, alias });
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/routes/${deleteTarget.id}`, { method: "DELETE" });
      if (response.ok) {
        setRoutes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        setDeleteTarget(null);
        toast("success", "경로가 삭제되었습니다.");
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

  async function handleChangeRouteType(id: string, routeType: string) {
    try {
      const response = await fetch(`/api/routes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeType }),
      });
      if (response.ok) {
        setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, routeType } : r)));
        toast("success", "경로 타입이 변경되었습니다.");
      } else {
        const data = await response.json();
        toast("error", data?.error?.message || "경로 타입 변경에 실패했습니다.");
      }
    } catch {
      toast("error", "경로 타입 변경 중 오류가 발생했습니다.");
    }
  }

  if (isLoading) return <div className="flex items-center justify-center py-12"><Spinner /></div>;

  if (error) return (
    <div className="space-y-4">
      <ErrorBanner message={error} />
      <button onClick={fetchRoutes} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">다시 시도</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">경로 관리</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{routes.length}/5개 경로</p>
        </div>
        {routes.length < 5 && (
          <Link href="/routes/new" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            경로 추가
          </Link>
        )}
      </div>

      {actionError && <ErrorBanner message={actionError} onClose={() => setActionError(null)} />}

      {routes.length > 0 ? (
        <div className="space-y-3">
          {routes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              onEditAlias={handleEditAlias}
              onDelete={handleDeleteClick}
              onChangeRouteType={handleChangeRouteType}
              onChangeMemo={handleChangeMemo}
              onError={setActionError}
              routeCount={routes.length}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <svg className="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">저장된 경로가 없습니다</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">경로를 추가해주세요</p>
          <Link href="/routes/new" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            경로 추가
          </Link>
        </div>
      )}

      <Dialog isOpen={deleteTarget !== null} onClose={() => !isDeleting && setDeleteTarget(null)} closeOnBackdrop={!isDeleting} labelId="delete-dialog-title">
        <h3 id="delete-dialog-title" className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">경로 삭제</h3>
        <p className="mb-5 text-sm text-gray-600 dark:text-gray-300">&quot;{deleteTarget?.alias}&quot; 경로를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">취소</button>
          <button onClick={handleDeleteConfirm} disabled={isDeleting} className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">{isDeleting ? "삭제 중..." : "삭제"}</button>
        </div>
      </Dialog>
    </div>
  );
}
