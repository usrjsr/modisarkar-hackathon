import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const PUBLIC_ROUTES = ["/login"]

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

  const isPublic = PUBLIC_ROUTES.includes(pathname)
  const isProtectedDashboard =
    pathname.startsWith("/zones") ||
    pathname.startsWith("/roster") ||
    pathname.startsWith("/personnel") ||
    pathname.startsWith("/incidents") ||
    pathname.startsWith("/settings") ||
    pathname === "/"

  if (!token && isProtectedDashboard) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
}