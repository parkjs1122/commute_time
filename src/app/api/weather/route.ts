import { NextResponse } from "next/server";
import { getWeather } from "@/services/weather-service";

/**
 * GET /api/weather
 * 현재 날씨 정보를 반환합니다 (Open-Meteo, 1시간 캐싱).
 */
export async function GET() {
  const weather = await getWeather();

  if (!weather) {
    return NextResponse.json(null);
  }

  return NextResponse.json(weather);
}
