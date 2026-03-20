import { auth } from "@/auth";

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isProtected = req.nextUrl.pathname.startsWith("/doc-gen") || req.nextUrl.pathname.startsWith("/admin");
  const isAuthPage = req.nextUrl.pathname === "/admin/auth" || req.nextUrl.pathname.startsWith("/api/auth");

  // Allow access to auth-related pages without redirecting
  if (isAuthPage) return;

  if (!isLoggedIn && isProtected) {
    const loginUrl = new URL("/admin/auth", req.nextUrl.origin);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
