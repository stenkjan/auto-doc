import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, createAuthToken } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const adminPassword = (process.env.ADMIN_PASSWORD ?? "").trim();

  if (!adminPassword || password.trim() !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = createAuthToken(adminPassword);
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
