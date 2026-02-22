import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleApiError, BadRequestError } from "@/lib/errors";

/**
 * GET /api/statistics?routeId=xxx&days=7
 * 특정 경로의 ETA 기록 통계를 반환합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get("routeId");
    const days = Math.min(Number(searchParams.get("days")) || 7, 30);

    if (!routeId) {
      throw new BadRequestError("routeId 파라미터가 필요합니다.");
    }

    // Verify route ownership
    const route = await prisma.savedRoute.findUnique({
      where: { id: routeId },
    });
    if (!route || route.userId !== session.user.id) {
      throw new BadRequestError("경로를 찾을 수 없습니다.");
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const records = await prisma.eTARecord.findMany({
      where: {
        routeId,
        recordedAt: { gte: since },
        isEstimate: false, // Only use real data
      },
      orderBy: { recordedAt: "asc" },
      select: {
        totalETA: true,
        waitTime: true,
        travelTime: true,
        recordedAt: true,
      },
    });

    // Group by day (KST)
    const dailyStats: Record<string, { totalETAs: number[]; waitTimes: number[]; count: number }> = {};
    const dayOfWeekStats: Record<number, { totalETAs: number[]; count: number }> = {};

    for (const r of records) {
      const kstDate = new Date(r.recordedAt.getTime() + 9 * 60 * 60 * 1000);
      const dateKey = kstDate.toISOString().slice(0, 10);
      const dayOfWeek = kstDate.getDay();

      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { totalETAs: [], waitTimes: [], count: 0 };
      }
      dailyStats[dateKey].totalETAs.push(r.totalETA);
      dailyStats[dateKey].waitTimes.push(r.waitTime);
      dailyStats[dateKey].count++;

      if (!dayOfWeekStats[dayOfWeek]) {
        dayOfWeekStats[dayOfWeek] = { totalETAs: [], count: 0 };
      }
      dayOfWeekStats[dayOfWeek].totalETAs.push(r.totalETA);
      dayOfWeekStats[dayOfWeek].count++;
    }

    // Calculate daily averages
    const daily = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      avgTotalETA: Math.round(stats.totalETAs.reduce((a, b) => a + b, 0) / stats.count),
      avgWaitTime: Math.round(stats.waitTimes.reduce((a, b) => a + b, 0) / stats.count),
      count: stats.count,
    }));

    // Calculate day-of-week averages
    const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
    const byDayOfWeek = Object.entries(dayOfWeekStats).map(([dow, stats]) => ({
      dayOfWeek: Number(dow),
      label: DOW_LABELS[Number(dow)],
      avgTotalETA: Math.round(stats.totalETAs.reduce((a, b) => a + b, 0) / stats.count),
      count: stats.count,
    })).sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    // Overall stats
    const allETAs = records.map((r) => r.totalETA);
    const overall = allETAs.length > 0
      ? {
          avgTotalETA: Math.round(allETAs.reduce((a, b) => a + b, 0) / allETAs.length),
          minTotalETA: Math.min(...allETAs),
          maxTotalETA: Math.max(...allETAs),
          recordCount: allETAs.length,
        }
      : null;

    return NextResponse.json({
      routeId,
      days,
      overall,
      daily,
      byDayOfWeek,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
