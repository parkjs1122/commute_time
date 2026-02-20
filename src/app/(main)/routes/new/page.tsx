"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PlaceSearchInput from "@/components/PlaceSearchInput";
import LegDetail from "@/components/LegDetail";
import Spinner from "@/components/Spinner";
import type { Place, TransitRoute, SaveRouteRequest, RouteType } from "@/types";

/**
 * 경로 결과 카드 컴포넌트
 */
function RouteResultCard({
  route,
  index,
  onSave,
}: {
  route: TransitRoute;
  index: number;
  onSave: (route: TransitRoute) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          경로 {index + 1}
        </span>
        <button
          onClick={() => onSave(route)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          저장
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          총 {route.totalTime}분
        </span>
        <span className="flex items-center gap-1">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
            />
          </svg>
          환승 {route.transferCount}회
        </span>
        {route.walkTime != null && route.walkTime > 0 && (
          <span className="flex items-center gap-1">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0"
              />
            </svg>
            도보 {route.walkTime}분
          </span>
        )}
        {route.fare != null && (
          <span className="flex items-center gap-1">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            {route.fare.toLocaleString()}원
          </span>
        )}
      </div>

      {/* 구간별 상세 정보 */}
      <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
        <LegDetail legs={route.legs} />
      </div>
    </div>
  );
}

/**
 * 별칭 입력 다이얼로그 컴포넌트
 */
function AliasDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (alias: string, routeType: RouteType) => void;
  isLoading: boolean;
}) {
  const [alias, setAlias] = useState("");
  const [routeType, setRouteType] = useState<RouteType>("commute");

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (alias.trim()) {
      onConfirm(alias.trim(), routeType);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          경로 저장
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="alias"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              경로 이름
            </label>
            <input
              id="alias"
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="예: 집에서 회사까지"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              경로 타입
            </label>
            <div className="flex gap-3">
              {([
                { value: "commute", label: "출근" },
                { value: "return", label: "퇴근" },
                { value: "other", label: "기타" },
              ] as const).map((option) => (
                <label
                  key={option.value}
                  className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors ${
                    routeType === option.value
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="routeType"
                    value={option.value}
                    checked={routeType === option.value}
                    onChange={() => setRouteType(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!alias.trim() || isLoading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewRoutePage() {
  const router = useRouter();

  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [routes, setRoutes] = useState<TransitRoute[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // 저장 다이얼로그 상태
  const [selectedRoute, setSelectedRoute] = useState<TransitRoute | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleOriginSelect = useCallback((place: Place) => {
    setOrigin(place);
    setHasSearched(false);
    setRoutes([]);
  }, []);

  const handleDestinationSelect = useCallback((place: Place) => {
    setDestination(place);
    setHasSearched(false);
    setRoutes([]);
  }, []);

  async function handleSearch() {
    if (!origin || !destination) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const response = await fetch("/api/routes/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: {
            name: origin.name,
            lat: origin.latitude,
            lng: origin.longitude,
          },
          destination: {
            name: destination.name,
            lat: destination.latitude,
            lng: destination.longitude,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data?.error?.message || "경로 탐색에 실패했습니다."
        );
      }

      const data: TransitRoute[] = await response.json();
      setRoutes(data);
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "경로 탐색 중 오류가 발생했습니다."
      );
    } finally {
      setIsSearching(false);
    }
  }

  function handleSaveClick(route: TransitRoute) {
    setSelectedRoute(route);
    setIsDialogOpen(true);
    setSaveError(null);
  }

  async function handleSaveConfirm(alias: string, routeType: RouteType) {
    if (!selectedRoute || !origin || !destination) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const body: SaveRouteRequest = {
        alias,
        origin,
        destination,
        route: selectedRoute,
        routeType,
      };

      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data?.error?.message || "경로 저장에 실패했습니다."
        );
      }

      router.push("/routes");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "경로 저장 중 오류가 발생했습니다."
      );
      setIsSaving(false);
    }
  }

  function handleDialogClose() {
    if (!isSaving) {
      setIsDialogOpen(false);
      setSelectedRoute(null);
      setSaveError(null);
    }
  }

  const canSearch = origin !== null && destination !== null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          새 경로 추가
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          출발지와 목적지를 검색한 후 경로를 탐색하세요.
        </p>
      </div>

      {/* 장소 검색 섹션 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="space-y-4">
          <PlaceSearchInput
            label="출발지"
            placeholder="출발지를 검색하세요"
            onSelect={handleOriginSelect}
          />
          <PlaceSearchInput
            label="목적지"
            placeholder="목적지를 검색하세요"
            onSelect={handleDestinationSelect}
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={!canSearch || isSearching}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSearching ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" />
              경로 탐색 중...
            </span>
          ) : (
            "경로 탐색"
          )}
        </button>
      </div>

      {/* 검색 에러 */}
      {searchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">
            {searchError}
          </p>
        </div>
      )}

      {/* 검색 결과 */}
      {hasSearched && !isSearching && routes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            탐색 결과 ({routes.length}개)
          </h2>
          {routes.map((route, index) => (
            <RouteResultCard
              key={index}
              route={route}
              index={index}
              onSave={handleSaveClick}
            />
          ))}
        </div>
      )}

      {/* 결과 없음 */}
      {hasSearched && !isSearching && routes.length === 0 && !searchError && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            경로를 찾을 수 없습니다. 다른 장소를 검색해보세요.
          </p>
        </div>
      )}

      {/* 저장 에러 */}
      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">
            {saveError}
          </p>
        </div>
      )}

      {/* 별칭 입력 다이얼로그 */}
      <AliasDialog
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        onConfirm={handleSaveConfirm}
        isLoading={isSaving}
      />
    </div>
  );
}
