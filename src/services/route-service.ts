import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError, MaxRoutesExceededError } from "@/lib/errors";
import type { SaveRouteRequest } from "@/types";

const MAX_ROUTES_PER_USER = 5;

const INCLUDE_ORDERED_LEGS = { legs: { orderBy: { order: "asc" as const } } };

/**
 * 경로 저장 및 관리 서비스
 */
export const RouteService = {
  /**
   * 경로를 조회하고 소유자를 확인합니다.
   * 존재하지 않으면 RouteNotFoundError, 소유자가 아니면 RouteUnauthorizedError를 throw합니다.
   */
  async findRouteOrThrow(routeId: string, userId: string) {
    const route = await prisma.savedRoute.findUnique({ where: { id: routeId } });
    if (!route) throw new RouteNotFoundError();
    if (route.userId !== userId) throw new RouteUnauthorizedError();
    return route;
  },

  /**
   * 경로를 저장합니다.
   * - 사용자당 최대 5개까지 저장 가능
   * - isDefault가 true이면 기존 기본 경로를 해제합니다.
   */
  async saveRoute(userId: string, data: SaveRouteRequest) {
    // 사용자의 저장된 경로 수 확인
    const count = await prisma.savedRoute.count({
      where: { userId },
    });

    if (count >= MAX_ROUTES_PER_USER) {
      throw new MaxRoutesExceededError(MAX_ROUTES_PER_USER);
    }

    const routeCreateData = {
      userId,
      alias: data.alias,
      isDefault: data.isDefault,
      routeType: data.routeType,
      originName: data.origin.name,
      originAddress: data.origin.roadAddress || data.origin.address,
      originLat: data.origin.latitude,
      originLng: data.origin.longitude,
      destName: data.destination.name,
      destAddress: data.destination.roadAddress || data.destination.address,
      destLat: data.destination.latitude,
      destLng: data.destination.longitude,
      totalTime: data.route.totalTime,
      transferCount: data.route.transferCount,
      fare: data.route.fare ?? null,
      legs: {
        create: data.route.legs.map((leg, index) => ({
          order: index,
          type: leg.type,
          lineNames: leg.lineNames ?? [],
          lineColor: leg.lineColor ?? null,
          startStation: leg.startStation ?? null,
          endStation: leg.endStation ?? null,
          startStationId: leg.startStationId ?? null,
          stationCount: leg.stationCount ?? null,
          sectionTime: leg.sectionTime,
          distance: leg.distance ?? null,
        })),
      },
    };

    // isDefault가 true이면 기존 기본 경로 해제 후 생성 (트랜잭션)
    if (data.isDefault) {
      return prisma.$transaction(async (tx) => {
        await tx.savedRoute.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });

        return tx.savedRoute.create({
          data: routeCreateData,
          include: INCLUDE_ORDERED_LEGS,
        });
      });
    }

    // isDefault가 false인 경우 바로 생성
    return prisma.savedRoute.create({
      data: routeCreateData,
      include: INCLUDE_ORDERED_LEGS,
    });
  },

  /**
   * 사용자의 모든 저장된 경로를 조회합니다.
   * isDefault 내림차순, createdAt 내림차순 정렬
   */
  async getRoutes(userId: string) {
    return prisma.savedRoute.findMany({
      where: { userId },
      include: INCLUDE_ORDERED_LEGS,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  },

  /**
   * 경로 별칭을 수정합니다.
   * 소유자 확인 후 업데이트합니다.
   */
  async updateAlias(routeId: string, userId: string, alias: string) {
    await this.findRouteOrThrow(routeId, userId);

    return prisma.savedRoute.update({
      where: { id: routeId },
      data: { alias },
      include: INCLUDE_ORDERED_LEGS,
    });
  },

  /**
   * 경로를 삭제합니다.
   * 소유자 확인 후 삭제합니다.
   */
  async deleteRoute(routeId: string, userId: string): Promise<void> {
    await this.findRouteOrThrow(routeId, userId);

    await prisma.savedRoute.delete({
      where: { id: routeId },
    });
  },

  /**
   * 경로를 기본 경로로 설정합니다.
   * 기존 기본 경로를 해제하고 새 기본 경로를 설정합니다 (트랜잭션).
   */
  async setDefault(routeId: string, userId: string) {
    await this.findRouteOrThrow(routeId, userId);

    return prisma.$transaction(async (tx) => {
      // 기존 기본 경로 해제
      await tx.savedRoute.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      // 새 기본 경로 설정
      return tx.savedRoute.update({
        where: { id: routeId },
        data: { isDefault: true },
        include: INCLUDE_ORDERED_LEGS,
      });
    });
  },
};

/**
 * 경로를 찾을 수 없을 때 발생하는 에러
 */
export class RouteNotFoundError extends NotFoundError {
  constructor() {
    super("경로를 찾을 수 없습니다.");
    this.name = "RouteNotFoundError";
  }
}

/**
 * 경로 소유자가 아닐 때 발생하는 에러
 */
export class RouteUnauthorizedError extends ForbiddenError {
  constructor() {
    super("해당 경로에 대한 권한이 없습니다.");
    this.name = "RouteUnauthorizedError";
  }
}
