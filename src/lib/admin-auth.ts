import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_EMAILS = ["jan@hoam-house.com", "markus@hoam-house.com"];

export function isAdminUser(
  session: { user?: { email?: string | null; role?: string } | null } | null
): boolean {
  if (!session?.user) return false;
  return (
    session.user.role === "admin" ||
    (!!session.user.email && ADMIN_EMAILS.includes(session.user.email))
  );
}

export async function validateAdminAuth(
  _request?: NextRequest
): Promise<boolean> {
  const session = await auth();
  return !!session?.user;
}

export async function requireAdminAuth(
  _request?: NextRequest
): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized - authentication required" },
      { status: 401 }
    );
  }
  return null;
}

export async function requireAdminRole(
  _request?: NextRequest
): Promise<NextResponse | null> {
  const session = await auth();
  if (!isAdminUser(session)) {
    return NextResponse.json(
      { error: "Forbidden - admin access required" },
      { status: 403 }
    );
  }
  return null;
}

export async function getAuthSession() {
  return auth();
}
