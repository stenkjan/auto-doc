import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "autodoc-admin-auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAuthPage = pathname === "/admin/auth";
  const isAuthApi = pathname === "/api/admin/auth";

  if (isAuthPage || isAuthApi) return NextResponse.next();

  if (isAdminRoute || isAdminApi) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const cookie = request.cookies.get(COOKIE_NAME);

    if (!adminPassword || !cookie || cookie.value !== adminPassword) {
      if (isAdminApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/auth", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
