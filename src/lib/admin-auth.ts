import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export const COOKIE_NAME = "autodoc-admin-auth";

function getAdminPassword(): string {
  return (process.env.ADMIN_PASSWORD ?? "").trim();
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function createAuthToken(password: string): string {
  return hashPassword(password.trim());
}

export async function validateAdminAuth(
  request: NextRequest
): Promise<boolean> {
  const adminPassword = getAdminPassword();
  if (!adminPassword) return false;

  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie) return false;

  return cookie.value === hashPassword(adminPassword);
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
  const adminPassword = getAdminPassword();
  if (!adminPassword) return false;

  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie) return false;

  return cookie.value === hashPassword(adminPassword);
}
