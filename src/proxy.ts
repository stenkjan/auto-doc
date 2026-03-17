import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const COOKIE_NAME = "autodoc-admin-auth";

function getExpectedToken(): string | null {
  const pw = (process.env.ADMIN_PASSWORD ?? "").trim();
  if (!pw) return null;
  return crypto.createHash("sha256").update(pw).digest("hex");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAuthPage = pathname === "/admin/auth";
  const isAuthApi = pathname === "/api/admin/auth";

  if (isAuthPage || isAuthApi) return NextResponse.next();

  if (isAdminRoute || isAdminApi) {
    const expectedToken = getExpectedToken();
    const cookie = request.cookies.get(COOKIE_NAME);

    if (!expectedToken || !cookie || cookie.value !== expectedToken) {
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
