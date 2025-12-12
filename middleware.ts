import { NextRequest, NextResponse } from "next/server";

const apiOrigins = [
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  "http://localhost:3001",
];

const AUTH_COOKIE_NAME = "estoque_auth";

const withCsp = (res: NextResponse) => {
  const connectSrc = ["'self'", "ws:", "wss:", ...apiOrigins];

  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src ${connectSrc.join(" ")}`,
      "frame-src 'self'",
      "worker-src 'self' blob:",
    ].join("; "),
  );

  return res;
};

export function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");

  if (!token && !isAuthPage) {
    const url = new URL("/login", request.url);
    return withCsp(NextResponse.redirect(url));
  }

  if (token && isAuthPage) {
    const url = new URL("/painel", request.url);
    return withCsp(NextResponse.redirect(url));
  }

  return withCsp(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
