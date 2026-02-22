// 장소 검색 결과
export interface Place {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  latitude: number;
  longitude: number;
  category: string;
}

// 경로 구간 (Leg)
export interface RouteLeg {
  type: "bus" | "subway" | "walk" | "train";
  lineNames: string[];
  lineColor?: string;
  startStation?: string;
  endStation?: string;
  startStationId?: string;
  stationCount?: number;
  sectionTime: number; // 분
  distance?: number; // 미터
  legSubType?: string; // "intercity_bus" | "express_bus" (시외/고속버스 구분)
}

// 대중교통 경로
export interface TransitRoute {
  totalTime: number; // 분
  transferCount: number;
  walkTime: number; // 분
  fare?: number; // 원
  legs: RouteLeg[];
  departureTime?: string;
  arrivalTime?: string;
  routeSource?: "in_local" | "inter_local";
}

// 실시간 도착 정보
export interface ArrivalInfo {
  stationName: string;
  lineName: string;
  direction: string;
  arrivalTime: number; // 초
  arrivalMessage: string;
  remainingStops?: number;
  vehicleType?: string;
  isLastTrain?: boolean;
  destination?: string; // 종착역 (지하철)
}

// 대중교통 도착 정보 (대시보드용)
export interface LegArrivalInfo {
  type: "bus" | "subway" | "train";
  lineName: string;
  arrivalMessage: string;
  arrivalTime: number; // 초
  startStation?: string; // 승차 정류장/역
  endStation?: string; // 하차 정류장/역
  destination?: string; // 종착역 (지하철)
  isSchedule?: boolean; // true = 시간표 기반 (시외버스)
}

// 경로 타입
export type RouteType = "commute" | "return" | "other";

// ETA 결과
export interface ETAResult {
  estimatedArrival: string; // ISO 8601
  waitTime: number; // 초
  travelTime: number; // 분
  isEstimate: boolean;
  routeId: string;
  routeAlias: string;
  routeType: RouteType;
  routeSource?: "in_local" | "inter_local";
  legArrivals: LegArrivalInfo[];
}

// API 에러 응답
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Prisma SavedRoute with legs included
export type SavedRouteWithLegs = import("@prisma/client").SavedRoute & {
  legs: import("@prisma/client").RouteLeg[];
};

// 경로 저장 요청
export interface SaveRouteRequest {
  alias: string;
  origin: Place;
  destination: Place;
  route: TransitRoute;
  routeType: RouteType;
}

// 대시보드 응답
export interface DashboardResponse {
  routes: ETAResult[];
  lastUpdated: string;
}

// 날씨 데이터
export interface WeatherData {
  temperature: number;
  weatherCode: number;
  description: string;
  isRainy: boolean;
  icon: string;
}

// 통계 응답
export interface StatisticsResponse {
  routeId: string;
  days: number;
  overall: {
    avgTotalETA: number;
    minTotalETA: number;
    maxTotalETA: number;
    recordCount: number;
  } | null;
  daily: Array<{
    date: string;
    avgTotalETA: number;
    avgWaitTime: number;
    count: number;
  }>;
  byDayOfWeek: Array<{
    dayOfWeek: number;
    label: string;
    avgTotalETA: number;
    count: number;
  }>;
}
