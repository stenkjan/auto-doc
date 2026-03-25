import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = ["jan@hoam-house.com", "markus@hoam-house.com"];

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? "",
      from: "Auto Doc <noreply@hoam-house.com>",
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
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
        token.role = ADMIN_EMAILS.includes(user.email) ? "admin" : "user";
        // Persist billing setup status so we know if redirect to /account/setup is needed
        if (user.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { defaultPaymentMethodId: true, billingAddress: true, role: true },
          });
          token.role = dbUser?.role ?? token.role;
          token.billingComplete =
            !!(dbUser?.defaultPaymentMethodId && dbUser?.billingAddress);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
        session.user.billingComplete = token.billingComplete as boolean;
      }
      return session;
    },
    async signIn({ user }) {
      // Ensure role is set in DB on every sign-in for admin emails
      if (user.email && ADMIN_EMAILS.includes(user.email) && user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "admin" },
        }).catch(() => {
          // User may not exist yet on first sign-in (adapter creates them after)
        });
      }
      return true;
    },
  },
  secret: process.env.AUTH_SECRET,
});
