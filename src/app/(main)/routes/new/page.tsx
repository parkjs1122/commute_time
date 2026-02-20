"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PlaceSearchInput from "@/components/PlaceSearchInput";
import LegDetail from "@/components/LegDetail";
import RouteSourceBadge from "@/components/RouteSourceBadge";
import Spinner from "@/components/Spinner";
import Dialog from "@/components/Dialog";
import ErrorBanner from "@/components/ErrorBanner";
import { useToast } from "@/components/ToastProvider";
import type { Place, TransitRoute, SaveRouteRequest, RouteType } from "@/types";

/**
 * 역방향 alias 자동 생성
 */
function generateReverseAlias(
  alias: string,
  originName: string,
  destName: string
): string {
  const match = alias.match(/^(.+)에서\s+(.+)까지$/);
  if (match) {
    return `${match[2]}에서 ${match[1]}까지`;
  }
  return `${destName} → ${originName}`;
}

/**
 * 경로 결과 카드 컴포넌트
 */
function RouteResultCard({
  route,
  index,
  onSave,
  saveLabel = "저장",
}: {
  route: TransitRoute;
  index: number;
  onSave: (route: TransitRoute) => void;
  saveLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            경로 {index + 1}
          </span>
          <RouteSourceBadge routeSource={route.routeSource} />
        </div>
        <button
          onClick={() => onSave(route)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          {saveLabel}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          총 {route.totalTime}분
        </span>
        <span className="flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          환승 {route.transferCount}회
        </span>
        {route.walkTime != null && route.walkTime > 0 && (
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
            </svg>
            도보 {route.walkTime}분
          </span>
        )}
        {route.fare != null && (
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {route.fare.toLocaleString()}원
          </span>
        )}
      </div>

      <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
        <LegDetail legs={route.legs} />
      </div>
    </div>
  );
}

export default function NewRoutePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [routes, setRoutes] = useState<TransitRoute[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Swap key to force re-render of PlaceSearchInput
  const [swapKey, setSwapKey] = useState(0);

  // 저장 다이얼로그 상태
  const [selectedRoute, setSelectedRoute] = useState<TransitRoute | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [routeType, setRouteType] = useState<RouteType>("commute");

  // 역방향 제안 상태
  const [showReversePrompt, setShowReversePrompt] = useState(false);
  const [showReverseSelect, setShowReverseSelect] = useState(false);
  const [reverseRoutes, setReverseRoutes] = useState<TransitRoute[]>([]);
  const [isReverseSearching, setIsReverseSearching] = useState(false);
  const [reverseSavingIndex, setReverseSavingIndex] = useState<number | null>(null);
  const [reverseAlias, setReverseAlias] = useState("");
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [savedRouteType, setSavedRouteType] = useState<RouteType | null>(null);
  const [savedAlias, setSavedAlias] = useState("");

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

  function handleSwap() {
    if (!origin && !destination) return;
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
    setSwapKey((k) => k + 1);
    setHasSearched(false);
    setRoutes([]);
  }

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
          origin: { name: origin.name, lat: origin.latitude, lng: origin.longitude },
          destination: { name: destination.name, lat: destination.latitude, lng: destination.longitude },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error?.message || "경로 탐색에 실패했습니다.");
      }

      const data: TransitRoute[] = await response.json();
      setRoutes(data);
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "경로 탐색 중 오류가 발생했습니다."
      );
    } finally {
      setIsSearching(false);
    }
  }

  function handleSaveClick(route: TransitRoute) {
    setSelectedRoute(route);
    setIsDialogOpen(true);
    setSaveError(null);
    setAlias("");
    setRouteType("commute");
  }

  async function handleSaveConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoute || !origin || !destination || !alias.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const body: SaveRouteRequest = {
        alias: alias.trim(),
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
        throw new Error(data?.error?.message || "경로 저장에 실패했습니다.");
      }

      setIsDialogOpen(false);
      setIsSaving(false);
      toast("success", "경로가 저장되었습니다.");

      // 출근/퇴근인 경우 역방향 제안
      if (routeType === "commute" || routeType === "return") {
        try {
          const routesRes = await fetch("/api/routes");
          if (routesRes.ok) {
            const existingRoutes = await routesRes.json();
            if (existingRoutes.length >= 5) {
              router.push("/routes");
              return;
            }
          }
        } catch {
          // 조회 실패해도 제안은 시도
        }

        setSavedAlias(alias.trim());
        setSavedRouteType(routeType);
        setReverseAlias(generateReverseAlias(alias.trim(), origin.name, destination.name));
        setShowReversePrompt(true);
      } else {
        router.push("/routes");
      }
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "경로 저장 중 오류가 발생했습니다."
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

  // 역방향 제안 수락 → 경로 탐색
  async function handleReverseAccept() {
    if (!origin || !destination) return;

    setShowReversePrompt(false);
    setShowReverseSelect(true);
    setIsReverseSearching(true);
    setReverseError(null);
    setReverseRoutes([]);

    try {
      const response = await fetch("/api/routes/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { name: destination.name, lat: destination.latitude, lng: destination.longitude },
          destination: { name: origin.name, lat: origin.latitude, lng: origin.longitude },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error?.message || "역방향 경로 탐색에 실패했습니다.");
      }

      const data: TransitRoute[] = await response.json();
      setReverseRoutes(data);

      if (data.length === 0) {
        setReverseError("역방향 경로를 찾을 수 없습니다.");
      }
    } catch (error) {
      setReverseError(
        error instanceof Error ? error.message : "역방향 경로 탐색 중 오류가 발생했습니다."
      );
    } finally {
      setIsReverseSearching(false);
    }
  }

  function handleReverseSkip() {
    setShowReversePrompt(false);
    setShowReverseSelect(false);
    router.push("/routes");
  }

  // 역방향 경로 저장
  async function handleReverseSave(route: TransitRoute, index: number) {
    if (!origin || !destination || !reverseAlias.trim() || !savedRouteType) return;

    setReverseSavingIndex(index);
    setReverseError(null);

    const reverseType: RouteType = savedRouteType === "commute" ? "return" : "commute";

    try {
      const body: SaveRouteRequest = {
        alias: reverseAlias.trim(),
        origin: destination,
        destination: origin,
        route,
        routeType: reverseType,
      };

      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error?.message || "역방향 경로 저장에 실패했습니다.");
      }

      toast("success", "역방향 경로가 저장되었습니다.");
      router.push("/routes");
    } catch (error) {
      setReverseError(
        error instanceof Error ? error.message : "역방향 경로 저장 중 오류가 발생했습니다."
      );
      setReverseSavingIndex(null);
    }
  }

  const canSearch = origin !== null && destination !== null;
  const reverseTypeLabel = savedRouteType === "commute" ? "퇴근" : "출근";

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
        <div className="space-y-3">
          <PlaceSearchInput
            key={`origin-${swapKey}`}
            label="출발지"
            placeholder="출발지를 검색하세요"
            onSelect={handleOriginSelect}
            defaultValue={origin?.name ?? ""}
          />

          {/* 교환 버튼 */}
          <div className="flex justify-center">
            <button
              onClick={handleSwap}
              disabled={!origin && !destination}
              className="rounded-full border border-gray-200 bg-white p-2 text-gray-400 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
              aria-label="출발지와 목적지 교환"
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
                  d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
                />
              </svg>
            </button>
          </div>

          <PlaceSearchInput
            key={`dest-${swapKey}`}
            label="목적지"
            placeholder="목적지를 검색하세요"
            onSelect={handleDestinationSelect}
            defaultValue={destination?.name ?? ""}
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
      {searchError && <ErrorBanner message={searchError} />}

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
      {saveError && <ErrorBanner message={saveError} />}

      {/* 별칭 입력 다이얼로그 */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={handleDialogClose}
        closeOnBackdrop={!isSaving}
        labelId="save-dialog-title"
      >
        <h3
          id="save-dialog-title"
          className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          경로 저장
        </h3>
        <form onSubmit={handleSaveConfirm}>
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
              onClick={handleDialogClose}
              disabled={isSaving}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!alias.trim() || isSaving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* 역방향 경로 제안 다이얼로그 */}
      <Dialog
        isOpen={showReversePrompt}
        onClose={handleReverseSkip}
        labelId="reverse-prompt-title"
      >
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <svg
              className="h-6 w-6 text-blue-600 dark:text-blue-400"
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
          </div>
        </div>
        <h3
          id="reverse-prompt-title"
          className="mb-2 text-center text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          {reverseTypeLabel} 경로도 등록할까요?
        </h3>
        <p className="mb-1 text-center text-sm text-gray-500 dark:text-gray-400">
          &ldquo;{savedAlias}&rdquo; 경로를 저장했습니다.
        </p>
        <p className="mb-5 text-center text-sm text-gray-500 dark:text-gray-400">
          출발지와 목적지를 뒤집어 {reverseTypeLabel} 경로도 함께 등록할 수 있습니다.
        </p>
        <div className="mb-4 rounded-lg bg-gray-50 px-4 py-3 text-center dark:bg-gray-700/50">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {destination?.name} → {origin?.name}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReverseSkip}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={handleReverseAccept}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            등록하기
          </button>
        </div>
      </Dialog>

      {/* 역방향 경로 선택 다이얼로그 */}
      <Dialog
        isOpen={showReverseSelect}
        onClose={() => reverseSavingIndex === null && handleReverseSkip()}
        maxWidth="lg"
        closeOnBackdrop={reverseSavingIndex === null}
        labelId="reverse-select-title"
      >
        <h3
          id="reverse-select-title"
          className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          {reverseTypeLabel} 경로 선택
        </h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {destination?.name} → {origin?.name}
        </p>

        {isReverseSearching && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner className="h-6 w-6" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              역방향 경로를 탐색하고 있습니다...
            </p>
          </div>
        )}

        {reverseError && (
          <div className="mb-4">
            <ErrorBanner message={reverseError} />
          </div>
        )}

        {!isReverseSearching && reverseRoutes.length > 0 && (
          <>
            <div className="mb-4">
              <label
                htmlFor="reverseAlias"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                경로 이름
              </label>
              <input
                id="reverseAlias"
                type="text"
                value={reverseAlias}
                onChange={(e) => setReverseAlias(e.target.value)}
                placeholder="예: 회사에서 집까지"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-3">
              {reverseRoutes.map((route, index) => (
                <RouteResultCard
                  key={index}
                  route={route}
                  index={index}
                  onSave={(r) => handleReverseSave(r, index)}
                  saveLabel={
                    reverseSavingIndex === index ? "저장 중..." : "이 경로 저장"
                  }
                />
              ))}
            </div>
          </>
        )}

        {!isReverseSearching && reverseRoutes.length === 0 && !reverseError && (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              역방향 경로를 찾을 수 없습니다.
            </p>
          </div>
        )}

        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
          <button
            type="button"
            onClick={handleReverseSkip}
            disabled={reverseSavingIndex !== null}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            건너뛰기
          </button>
        </div>
      </Dialog>
    </div>
  );
}
