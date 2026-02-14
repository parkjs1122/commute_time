import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * 애플리케이션 공통 에러 클래스
 *
 * API 라우트에서 throw하면 상위 catch 블록에서 코드/메시지/상태를 일관되게
 * 추출하여 에러 응답을 생성할 수 있습니다.
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ── 자주 사용되는 에러 팩토리 ──

export class UnauthorizedError extends AppError {
  constructor(message = "로그인이 필요합니다.") {
    super("UNAUTHORIZED", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "해당 리소스에 대한 권한이 없습니다.") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "요청한 리소스를 찾을 수 없습니다.") {
    super("NOT_FOUND", message, 404);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "잘못된 요청입니다.") {
    super("BAD_REQUEST", message, 400);
    this.name = "BadRequestError";
  }
}

export class MaxRoutesExceededError extends AppError {
  constructor(max: number) {
    super("MAX_ROUTES_EXCEEDED", `최대 ${max}개의 경로만 저장할 수 있습니다.`, 400);
    this.name = "MaxRoutesExceededError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.") {
    super("RATE_LIMIT_EXCEEDED", message, 429);
    this.name = "RateLimitError";
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    serviceName: string,
    message = `외부 서비스(${serviceName})에 연결할 수 없습니다.`
  ) {
    super("EXTERNAL_SERVICE_ERROR", message, 502);
    this.name = "ExternalServiceError";
  }
}

// ── 인증 및 요청 파싱 헬퍼 ──

/**
 * 세션에서 인증된 사용자를 확인합니다.
 * 인증되지 않은 경우 UnauthorizedError를 throw합니다.
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  return session;
}

/**
 * Request body를 JSON으로 파싱합니다.
 * 유효하지 않은 JSON인 경우 BadRequestError를 throw합니다.
 */
export async function parseRequestBody<T = unknown>(request: Request): Promise<T> {
  try {
    return await request.json();
  } catch {
    throw new BadRequestError("요청 본문이 유효한 JSON이 아닙니다.");
  }
}

// ── 일관된 에러 응답 생성 헬퍼 ──

/**
 * NextResponse.json 에러 응답을 일관된 형식으로 생성합니다.
 *
 * 응답 형태:
 * ```json
 * { "error": { "code": "...", "message": "..." } }
 * ```
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number
) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Error 인스턴스로부터 에러 응답을 생성합니다.
 * AppError인 경우 내장된 code/statusCode를 사용하고,
 * 그 외에는 500 INTERNAL_ERROR로 처리합니다.
 */
export function handleApiError(error: unknown) {
  console.error("[API Error]", error);

  if (error instanceof AppError) {
    return createErrorResponse(error.code, error.message, error.statusCode);
  }

  const message =
    error instanceof Error
      ? error.message
      : "알 수 없는 오류가 발생했습니다.";

  return createErrorResponse("INTERNAL_ERROR", message, 500);
}
