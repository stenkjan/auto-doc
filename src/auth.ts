import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "Admin Password",
      credentials: {
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const adminPassword = process.env.ADMIN_PASSWORD
        if (!adminPassword) {
          console.error("[auth] ADMIN_PASSWORD environment variable is not set")
          return null
        }

        const password = typeof credentials?.password === "string"
          ? credentials.password.trim()
          : ""

        if (password && password === adminPassword.trim()) {
          return { id: "1", name: "Admin" }
        }
        return null
      }
    })
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/admin/auth",
  },
  secret: process.env.AUTH_SECRET,
})
