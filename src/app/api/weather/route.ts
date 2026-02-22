import { NextRequest, NextResponse } from "next/server";
import { getWeather } from "@/services/weather-service";

/**
 * GET /api/weather?lat=37.5&lng=127.0
 * 현재 날씨 정보를 반환합니다 (Open-Meteo, 1시간 캐싱).
 * lat/lng가 없으면 서울 기본 좌표 사용.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : undefined;
  const lng = searchParams.get("lng") ? Number(searchParams.get("lng")) : undefined;

  const weather = await getWeather(lat, lng);

  if (!weather) {
    return NextResponse.json(null);
  }

  return NextResponse.json(weather);
}
