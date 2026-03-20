import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function validateAdminAuth(
  request?: NextRequest
): Promise<boolean> {
  const session = await auth();
  return !!session?.user;
}

export async function requireAdminAuth(
  request?: NextRequest
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
  const session = await auth();
  return !!session?.user;
}
