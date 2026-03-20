import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Admin Password",
      credentials: {
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (credentials?.password === process.env.ADMIN_PASSWORD) {
          // You can also add more fields like role: "admin"
          return { id: "1", name: "Admin" }
        }
        return null
      }
    })
  ],
  pages: {
    signIn: "/admin/auth",
  },
  secret: process.env.AUTH_SECRET || "fallback-secret-for-development-only-change-in-production",
})
