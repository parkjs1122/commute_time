"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { DashboardResponse, ETAResult } from "@/types";
import TransportBadge from "@/components/TransportBadge";
import RouteSourceBadge from "@/components/RouteSourceBadge";
import RouteTypeBadge from "@/components/RouteTypeBadge";
import Spinner from "@/components/Spinner";
import ErrorBanner from "@/components/ErrorBanner";
import { formatETATime, formatWaitTime, formatLastUpdated } from "@/lib/format-utils";

// ---------------------------------------------------------------------------
// Group arrivals by leg (station pair), then by line within each leg
// ---------------------------------------------------------------------------

type GroupedMessage = {
  text: string;
  destination?: string;
};

type GroupedLine = {
  type: "bus" | "subway";
  lineName: string;
  messages: GroupedMessage[];
};

type GroupedLeg = {
  startStation?: string;
  endStation?: string;
  lines: GroupedLine[];
};

function formatGroupedMessages(messages: GroupedMessage[]): string {
  if (messages.length === 0) return "";

  const allSameDestination =
    messages.every((m) => m.destination) &&
    new Set(messages.map((m) => m.destination)).size === 1;

  if (allSameDestination) {
    return `${messages[0].destination}행 ${messages.map((m) => m.text).join(", ")}`;
  }

  return messages
    .map((m) => (m.destination ? `${m.destination}행 ${m.text}` : m.text))
    .join(", ");
}

function groupByLeg(
  arrivals: {
    type: "bus" | "subway";
    lineName: string;
    arrivalMessage: string;
    startStation?: string;
    endStation?: string;
    destination?: string;
  }[]
): GroupedLeg[] {
  const legs: GroupedLeg[] = [];

  for (const arrival of arrivals) {
    const legKey = `${arrival.startStation ?? ""}>${arrival.endStation ?? ""}`;
    let leg = legs.find(
      (l) => `${l.startStation ?? ""}>${l.endStation ?? ""}` === legKey
    );

    if (!leg) {
      leg = {
        startStation: arrival.startStation,
        endStation: arrival.endStation,
        lines: [],
      };
      legs.push(leg);
    }

    const lineKey = `${arrival.type}:${arrival.lineName}`;
    const existingLine = leg.lines.find(
      (line) => `${line.type}:${line.lineName}` === lineKey
    );

    const message: GroupedMessage = {
      text: arrival.arrivalMessage,
      destination: arrival.destination,
    };

    if (existingLine) {
      existingLine.messages.push(message);
    } else {
      leg.lines.push({
        type: arrival.type,
        lineName: arrival.lineName,
        messages: [message],
      });
    }
  }

  return legs;
}

// ---------------------------------------------------------------------------
// Leg arrival detail (shared between primary and expanded additional cards)
// ---------------------------------------------------------------------------

function LegArrivalDetail({
  legArrivals,
  compact = false,
}: {
  legArrivals: ETAResult["legArrivals"];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      {groupByLeg(legArrivals).map((leg, legIdx) => (
        <div key={legIdx}>
          {(leg.startStation || leg.endStation) && (
            <div
              className={`flex items-center gap-1.5 font-medium text-gray-500 dark:text-gray-400 ${
                compact ? "mb-1 text-[11px]" : "mb-1.5 text-xs"
              }`}
            >
              {!compact && (
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
                </svg>
              )}
              <span>
                {leg.startStation ?? "출발"} &rarr;{" "}
                {leg.endStation ?? "도착"}
              </span>
            </div>
          )}
          <div className={compact ? "space-y-1" : "space-y-1.5 pl-1"}>
            {leg.lines.map((line, lineIdx) => (
              <div key={lineIdx} className={compact ? "flex flex-wrap items-center gap-2" : "flex flex-wrap items-center gap-2"}>
                <TransportBadge type={line.type} lineName={line.lineName} />
                <span className={compact ? "text-xs text-gray-500 dark:text-gray-400" : "text-sm text-gray-600 dark:text-gray-300"}>
                  {formatGroupedMessages(line.messages)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Off-hours state
// ---------------------------------------------------------------------------

function OffHoursCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <svg
        className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
        />
      </svg>
      <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        현재 운행 시간이 아닙니다
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        새벽 1시~5시는 운행이 중단됩니다
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
        <svg
          className="h-8 w-8 text-gray-400 dark:text-gray-500"
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
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        저장된 경로가 없습니다
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        경로를 추가해주세요
      </p>
      <Link
        href="/routes/new"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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
  );
}

// ---------------------------------------------------------------------------
// Primary ETA card (first / default route)
// ---------------------------------------------------------------------------

function PrimaryETACard({ route }: { route: ETAResult }) {
  const isOff = !route.estimatedArrival;

  if (isOff) {
    return <OffHoursCard />;
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-gray-800 ${
        route.isEstimate
          ? "border-amber-300 dark:border-amber-600"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      {route.isEstimate && (
        <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-amber-500" />
      )}

      <div className="p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {route.routeAlias}
          </h2>
          <RouteSourceBadge routeSource={route.routeSource} />
          <RouteTypeBadge routeType={route.routeType} />
          {route.isEstimate && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              추정치
            </span>
          )}
        </div>

        <p className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-gray-50">
          약 {formatETATime(route.estimatedArrival)} 도착 예정
        </p>

        {route.legArrivals.length > 0 && (
          <div className="mt-5">
            <LegArrivalDetail legArrivals={route.legArrivals} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            총 {route.travelTime}분
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            대기 {formatWaitTime(route.waitTime)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Additional route card (compact, expandable)
// ---------------------------------------------------------------------------

function AdditionalRouteCard({ route }: { route: ETAResult }) {
  const isOff = !route.estimatedArrival;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-lg border bg-white shadow-sm transition-shadow dark:bg-gray-800 ${
        route.isEstimate
          ? "border-amber-200 dark:border-amber-700"
          : "border-gray-200 dark:border-gray-700"
      } ${!isOff ? "cursor-pointer hover:shadow-md" : ""}`}
      onClick={() => !isOff && setExpanded(!expanded)}
      role={!isOff ? "button" : undefined}
      tabIndex={!isOff ? 0 : undefined}
      onKeyDown={(e) => {
        if (!isOff && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setExpanded(!expanded);
        }
      }}
      aria-expanded={!isOff ? expanded : undefined}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {route.routeAlias}
              </h3>
              <RouteSourceBadge routeSource={route.routeSource} />
              <RouteTypeBadge routeType={route.routeType} />
              {route.isEstimate && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  추정치
                </span>
              )}
            </div>

            {!isOff && !expanded && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                총 {route.travelTime}분 / 대기 {formatWaitTime(route.waitTime)}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isOff ? (
              <span className="text-sm text-gray-400 dark:text-gray-500">운행 종료</span>
            ) : (
              <p className="text-lg font-bold text-gray-900 dark:text-gray-50">
                {formatETATime(route.estimatedArrival)}
              </p>
            )}
            {!isOff && (
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            )}
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && !isOff && (
          <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
            {route.legArrivals.length > 0 && (
              <LegArrivalDetail legArrivals={route.legArrivals} compact />
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                총 {route.travelTime}분
              </span>
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                대기 {formatWaitTime(route.waitTime)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Refresh indicator
// ---------------------------------------------------------------------------

function RefreshIndicator({
  lastUpdated,
  isRefreshing,
  countdown,
  onManualRefresh,
}: {
  lastUpdated: string;
  isRefreshing: boolean;
  countdown: number;
  onManualRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {isRefreshing ? (
          "갱신 중..."
        ) : (
          <>
            {formatLastUpdated(lastUpdated)} 갱신 · {countdown}초 후
          </>
        )}
      </span>
      <button
        onClick={onManualRefresh}
        disabled={isRefreshing}
        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        aria-label="새로고침"
      >
        <svg
          className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL = 30;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      try {
        if (silent) setIsRefreshing(true);
        else setIsLoading(true);

        const response = await fetch("/api/dashboard");
        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error?.message || "대시보드 데이터를 불러오는 데 실패했습니다.");
        }

        const result: DashboardResponse = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "대시보드 데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setCountdown(REFRESH_INTERVAL);
      }
    },
    []
  );

  const startTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    intervalRef.current = setInterval(() => fetchDashboard({ silent: true }), REFRESH_INTERVAL * 1000);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? REFRESH_INTERVAL : prev - 1));
    }, 1000);
  }, [fetchDashboard]);

  const stopTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  useEffect(() => {
    fetchDashboard();
    startTimers();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTimers();
      } else {
        fetchDashboard({ silent: true });
        startTimers();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stopTimers();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchDashboard, startTimers, stopTimers]);

  function handleManualRefresh() {
    fetchDashboard({ silent: true });
    startTimers();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error} />
        <button
          onClick={() => fetchDashboard()}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data || data.routes.length === 0) return <EmptyState />;

  const [primaryRoute, ...additionalRoutes] = data.routes;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">대시보드</h1>
        <RefreshIndicator
          lastUpdated={data.lastUpdated}
          isRefreshing={isRefreshing}
          countdown={countdown}
          onManualRefresh={handleManualRefresh}
        />
      </div>
      <PrimaryETACard route={primaryRoute} />
      {additionalRoutes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">다른 경로</h2>
          {additionalRoutes.map((route) => (
            <AdditionalRouteCard key={route.routeId} route={route} />
          ))}
        </div>
      )}
    </div>
  );
}
