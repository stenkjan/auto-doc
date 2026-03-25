import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/services/token-encryption";

/**
 * GET /api/services/callback/[provider]
 * OAuth callback — exchanges code for tokens and persists them.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL ?? ""}/doc-gen?serviceError=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL ?? ""}/doc-gen?serviceError=missing_params`);
  }

  // Decode state to get userId
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    userId = decoded.userId;
  } catch {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL ?? ""}/doc-gen?serviceError=invalid_state`);
  }

  try {
    if (provider === "google-drive") {
      await handleGoogleDriveCallback(code, userId);
    } else if (provider === "github") {
      await handleGitHubCallback(code, userId);
    } else {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL ?? ""}/doc-gen?serviceError=unknown_provider`);
    }
  } catch (err) {
    console.error(`[services/callback/${provider}]`, err);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL ?? ""}/doc-gen?serviceError=token_exchange_failed`);
  }

  return NextResponse.redirect(`${process.env.NEXTAUTH_URL ?? ""}/doc-gen?serviceConnected=${provider}`);
}

async function handleGoogleDriveCallback(code: string, userId: string) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${process.env.NEXTAUTH_URL ?? ""}/api/services/callback/google-drive`,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!tokens.access_token) {
    throw new Error(`Google token exchange failed: ${tokens.error}`);
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  await prisma.connectedService.upsert({
    where: { userId_provider: { userId, provider: "google_drive" } },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
      expiresAt,
    },
    create: {
      userId,
      provider: "google_drive",
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      expiresAt,
    },
  });
}

async function handleGitHubCallback(code: string, userId: string) {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GITHUB_CLIENT_ID ?? "",
      client_secret: process.env.GITHUB_CLIENT_SECRET ?? "",
      redirect_uri: `${process.env.NEXTAUTH_URL ?? ""}/api/services/callback/github`,
    }),
  });

  const tokens = await tokenRes.json() as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
  };

  if (!tokens.access_token) {
    throw new Error(`GitHub token exchange failed: ${tokens.error}`);
  }

  await prisma.connectedService.upsert({
    where: { userId_provider: { userId, provider: "github" } },
    update: {
      accessToken: encrypt(tokens.access_token),
    },
    create: {
      userId,
      provider: "github",
      accessToken: encrypt(tokens.access_token),
    },
  });
}
