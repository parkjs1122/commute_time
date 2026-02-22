"use client";

import { useState, useEffect, useCallback } from "react";
import Spinner from "@/components/Spinner";
import ErrorBanner from "@/components/ErrorBanner";
import type { StatisticsResponse } from "@/types";

interface RouteOption {
  id: string;
  alias: string;
  routeType: string;
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}초`;
  if (s === 0) return `${m}분`;
  return `${m}분 ${s}초`;
}

// Simple bar chart using CSS
function BarChart({
  data,
  labelKey,
  valueKey,
  formatValue,
  maxHeight = 120,
}: {
  data: Array<Record<string, unknown>>;
  labelKey: string;
  valueKey: string;
  formatValue: (v: number) => string;
  maxHeight?: number;
}) {
  if (data.length === 0) return null;

  const values = data.map((d) => d[valueKey] as number);
  const maxVal = Math.max(...values);

  return (
    <div className="flex items-end gap-1" style={{ height: maxHeight }}>
      {data.map((d, i) => {
        const val = d[valueKey] as number;
        const label = d[labelKey] as string;
        const height = maxVal > 0 ? (val / maxVal) * (maxHeight - 24) : 0;

        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{formatValue(val)}</span>
            <div
              className="w-full max-w-[32px] rounded-t bg-blue-500 transition-all dark:bg-blue-400"
              style={{ height: Math.max(height, 2) }}
              title={`${label}: ${formatValue(val)}`}
            />
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function StatisticsPage() {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<StatisticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch routes
  useEffect(() => {
    async function loadRoutes() {
      try {
        const res = await fetch("/api/routes");
        if (!res.ok) throw new Error("경로 목록을 불러올 수 없습니다.");
        const data = await res.json();
        const routeOptions: RouteOption[] = data.map((r: { id: string; alias: string; routeType: string }) => ({
          id: r.id,
          alias: r.alias,
          routeType: r.routeType,
        }));
        setRoutes(routeOptions);
        if (routeOptions.length > 0) {
          setSelectedRouteId(routeOptions[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류 발생");
      } finally {
        setIsLoading(false);
      }
    }
    loadRoutes();
  }, []);

  const fetchStats = useCallback(async () => {
    if (!selectedRouteId) return;
    setIsLoadingStats(true);
    setError(null);
    try {
      const res = await fetch(`/api/statistics?routeId=${selectedRouteId}&days=${days}`);
      if (!res.ok) throw new Error("통계를 불러올 수 없습니다.");
      const data: StatisticsResponse = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setIsLoadingStats(false);
    }
  }, [selectedRouteId, days]);

  useEffect(() => {
    if (selectedRouteId) fetchStats();
  }, [selectedRouteId, days, fetchStats]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Spinner /></div>;
  }

  if (routes.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">통계</h1>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            저장된 경로가 없습니다. 경로를 추가하고 대시보드를 사용하면 통계가 쌓입니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">통계</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedRouteId}
          onChange={(e) => setSelectedRouteId(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.alias}
            </option>
          ))}
        </select>

        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                days === d
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {isLoadingStats ? (
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Overall stats */}
          {stats.overall ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">평균 소요시간</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{formatSeconds(stats.overall.avgTotalETA)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">최소 소요시간</p>
                <p className="mt-1 text-lg font-bold text-green-600 dark:text-green-400">{formatSeconds(stats.overall.minTotalETA)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">최대 소요시간</p>
                <p className="mt-1 text-lg font-bold text-red-600 dark:text-red-400">{formatSeconds(stats.overall.maxTotalETA)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">기록 수</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{stats.overall.recordCount}건</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                아직 기록된 데이터가 없습니다. 대시보드를 사용하면 자동으로 데이터가 수집됩니다.
              </p>
            </div>
          )}

          {/* Daily chart */}
          {stats.daily.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">일별 평균 소요시간</h3>
              <BarChart
                data={stats.daily.map((d) => ({
                  ...d,
                  label: d.date.slice(5), // MM-DD
                }))}
                labelKey="label"
                valueKey="avgTotalETA"
                formatValue={(v) => `${Math.round(v / 60)}분`}
                maxHeight={140}
              />
            </div>
          )}

          {/* Day-of-week chart */}
          {stats.byDayOfWeek.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">요일별 평균 소요시간</h3>
              <BarChart
                data={stats.byDayOfWeek}
                labelKey="label"
                valueKey="avgTotalETA"
                formatValue={(v) => `${Math.round(v / 60)}분`}
                maxHeight={140}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
