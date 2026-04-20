// middleware.ts — Edge middleware for route protection & security headers
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;

        // Check if session is expired server-side
        if (token?.expires && Date.now() > (token.expires as number) * 1000) {
            return NextResponse.redirect(new URL("/auth/session-expired", req.url));
        }

        // Enforce role-based route access
        const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
        if (isAdminRoute && token?.role !== "admin") {
            return NextResponse.redirect(new URL("/unauthorized", req.url));
        }

        // Add security headers to every response
        const response = NextResponse.next();
        response.headers.set("X-Frame-Options", "DENY");
        response.headers.set("X-Content-Type-Options", "nosniff");
        response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
        response.headers.set("Permissions-Policy", "geolocation=(), microphone=()");
        response.headers.set(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload"
        );

        return response;
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: "/auth/login",
        },
    }
);

export const config = {
    matcher: ["/((?!api/auth|api/backend|_next/static|_next/image|favicon.ico|auth/login|auth/register).*)"],
};
