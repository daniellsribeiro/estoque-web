import { NextResponse } from "next/server";

const apiOrigins = [
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  "http://localhost:3001",
];

export function middleware() {
  const res = NextResponse.next();

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
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
