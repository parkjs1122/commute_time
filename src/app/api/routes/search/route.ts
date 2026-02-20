import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { KakaoMapParser } from "@/services/kakao-map-parser";
import { TransitRoute } from "@/types";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { parseRequestBody, handleApiError, BadRequestError } from "@/lib/errors";

interface RouteSearchBody {
  origin: {
    name: string;
    lat: number;
    lng: number;
  };
  destination: {
    name: string;
    lat: number;
    lng: number;
  };
}

/**
 * 요청 body를 검증합니다.
 */
function validateBody(
  body: unknown
): body is RouteSearchBody {
  if (typeof body !== "object" || body === null) return false;

  const b = body as Record<string, unknown>;

  if (typeof b.origin !== "object" || b.origin === null) return false;
  if (typeof b.destination !== "object" || b.destination === null) return false;

  const origin = b.origin as Record<string, unknown>;
  const dest = b.destination as Record<string, unknown>;

  return (
    typeof origin.name === "string" &&
    typeof origin.lat === "number" &&
    typeof origin.lng === "number" &&
    typeof dest.name === "string" &&
    typeof dest.lat === "number" &&
    typeof dest.lng === "number"
  );
}

/**
 * 좌표를 캐시 키 문자열로 변환합니다.
 * 소수점 6자리까지 반올림하여 일관성을 유지합니다.
 * 파서 로직 변경 시 CACHE_VERSION을 올려 기존 캐시를 무효화합니다.
 */
const CACHE_VERSION = "v3";

function toCacheKey(lat: number, lng: number): string {
  return `${CACHE_VERSION}:${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * POST /api/routes/search
 *
 * 출발지와 목적지를 받아 대중교통 경로를 검색합니다.
 * 캐시가 있으면 캐시된 결과를 반환하고,
 * 없으면 KakaoMapParser를 통해 경로를 파싱한 뒤 캐시에 저장합니다.
 */
export async function POST(request: NextRequest) {
  try {
    // 요청 body 파싱
    const body = await parseRequestBody(request);

    // 요청 body 검증
    if (!validateBody(body)) {
      throw new BadRequestError(
        "origin과 destination에 name(string), lat(number), lng(number)가 필요합니다."
      );
    }

    const { origin, destination } = body;

    // 캐시 키 생성
    const originKey = toCacheKey(origin.lat, origin.lng);
    const destKey = toCacheKey(destination.lat, destination.lng);

    // --- 캐시 확인 ---
    const cached = await prisma.routeCache.findUnique({
      where: {
        originKey_destKey: {
          originKey,
          destKey,
        },
      },
    });

    if (cached && cached.expiresAt > new Date()) {
      // 캐시 히트: 만료되지 않은 캐시 데이터 반환
      const routes = cached.routeData as unknown as TransitRoute[];
      return NextResponse.json(routes);
    }

    // --- 캐시 미스: Kakao Maps 파싱 ---
    const parser = new KakaoMapParser();
    const routes = await parser.parseTransitRoutes(origin, destination);

    // 캐시에 저장 (24시간 만료)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // TransitRoute[]는 직렬화 가능한 JSON이므로 InputJsonValue로 캐스팅
    const routeJson = JSON.parse(JSON.stringify(routes)) as InputJsonValue;

    await prisma.routeCache.upsert({
      where: {
        originKey_destKey: {
          originKey,
          destKey,
        },
      },
      update: {
        routeData: routeJson,
        expiresAt,
      },
      create: {
        originKey,
        destKey,
        routeData: routeJson,
        expiresAt,
      },
    });

    return NextResponse.json(routes);
  } catch (error) {
    return handleApiError(error);
  }
}
