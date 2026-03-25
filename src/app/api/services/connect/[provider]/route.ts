import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

const SUPPORTED_PROVIDERS: Record<
  string,
  { available: boolean; authUrl: (state: string) => string }
> = {
  "google-drive": {
    available: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    authUrl: (state: string) => {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        redirect_uri: `${process.env.NEXTAUTH_URL ?? ""}/api/services/callback/google-drive`,
        response_type: "code",
        scope: GOOGLE_DRIVE_SCOPES,
        access_type: "offline",
        prompt: "consent",
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    },
  },
  github: {
    available: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    authUrl: (state: string) => {
      const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID ?? "",
        redirect_uri: `${process.env.NEXTAUTH_URL ?? ""}/api/services/callback/github`,
        scope: "repo read:user",
        state,
      });
      return `https://github.com/login/oauth/authorize?${params}`;
    },
  },
};

/**
 * GET /api/services/connect/[provider]
 * Initiates the OAuth flow for a connected service.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;
  const providerConfig = SUPPORTED_PROVIDERS[provider];

  if (!providerConfig) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }

  if (!providerConfig.available) {
    return NextResponse.json(
      { error: `${provider} integration is not yet configured` },
      { status: 501 }
    );
  }

  // Encode user ID in state to verify on callback
  const state = Buffer.from(
    JSON.stringify({ userId: session.user.id, ts: Date.now() })
  ).toString("base64url");

  return NextResponse.redirect(providerConfig.authUrl(state));
}
