import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const ADMIN_EMAILS = ["jan@hoam-house.com", "markus@hoam-house.com"];

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    // Only include Resend when the key is configured
    ...(process.env.AUTH_RESEND_KEY
      ? [Resend({
          apiKey: process.env.AUTH_RESEND_KEY,
          from: "Auto Doc <noreply@hoam-house.com>",
        })]
      : []),
    // Only include GitHub when credentials are configured
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [GitHub({
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        })]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth",
    newUser: "/account/setup",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        // Email-based admin check always takes precedence over whatever is in DB
        const isAdmin = ADMIN_EMAILS.includes(user.email);
        token.role = isAdmin ? "admin" : "user";

        if (user.id) {
          // Persist admin role to DB asynchronously (fire-and-forget)
          // This may fail on the very first sign-in (user not yet in DB) — that's fine,
          // role is always derived from the email list above.
          if (isAdmin) {
            prisma.user.update({
              where: { id: user.id },
              data: { role: "admin" },
            }).catch(() => {});
          }

          // Check billing completion for non-admin users
          if (!isAdmin) {
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { defaultPaymentMethodId: true, billingAddress: true },
            });
            token.billingComplete =
              !!(dbUser?.defaultPaymentMethodId && dbUser?.billingAddress);
          } else {
            token.billingComplete = true; // admins never need billing setup
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string;
        session.user.role = (token.role as string) ?? "user";
        session.user.billingComplete = (token.billingComplete as boolean) ?? false;
      }
      return session;
    },
    async signIn() {
      return true;
    },
  },
  secret: process.env.AUTH_SECRET,
});
