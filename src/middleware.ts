import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 인증 없이 접근 가능한 경로
  const publicPaths = ["/login", "/register", "/api/auth"];

  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  if (isPublicPath) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: "next-auth.session-token",
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * (main) 그룹 아래의 모든 경로를 보호합니다.
     * 정적 파일, _next, favicon 등은 제외합니다.
     */
    "/((?!_next/static|_next/image|favicon.ico|login|register|api/auth).*)",
  ],
};
