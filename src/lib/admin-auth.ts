import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "autodoc-admin-auth";

export async function validateAdminAuth(
  request: NextRequest
): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie) return false;

  return cookie.value === adminPassword;
}

export async function requireAdminAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  const isAuthenticated = await validateAdminAuth(request);
  if (!isAuthenticated) {
    return NextResponse.json(
      { error: "Unauthorized - Admin authentication required" },
      { status: 401 }
    );
  }
  return null;
}

export async function validateAdminAuthFromCookies(): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie) return false;

  return cookie.value === adminPassword;
}

export { COOKIE_NAME };
