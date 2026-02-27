import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {

  const { pathname } = req.nextUrl

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next()
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET
  })

  const isHome = pathname === "/"
  const isLogin = pathname === "/login"
  const isDashboard = pathname.startsWith("/dashboard")

  if (isHome && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  if (isLogin && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  if (isDashboard && !token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
}