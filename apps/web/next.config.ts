import type { NextConfig } from "next";

// The FastAPI backend URL — set RISK_API_URL in apps/web/.env to your server's IP.
// e.g.  RISK_API_URL=http://192.168.1.100:8000
const API_URL = process.env.RISK_API_URL || "http://localhost:8000";

const isClientInstance = process.env.NEXT_PUBLIC_IS_SERVER === "false";

const nextConfig: NextConfig = {
  // Use a separate build directory for the client instance so it doesn't collide with the admin's .next folder
  distDir: isClientInstance ? '.next-client' : '.next',
  /**
   * API Proxy / Rewrites
   * -------------------------------------------------------------------
   * Any request from the browser to /api/backend/* is forwarded
   * server-to-server to the FastAPI backend.  This means:
   *  • No CORS issues on client machines (browser talks only to Next.js)
   *  • The FastAPI server IP never needs to be exposed to client browsers
   *  • CORS_ORIGINS in apps/api/.env only needs to list the server's own origin
   *
   * Usage in frontend code:
   *   fetch("/api/backend/api/auth/login", { ... })
   *   // → forwarded to http://<SERVER_IP>:8000/api/auth/login
   *
   * Direct calls (without /api/backend prefix) still work too, but need
   * CORS configured on the FastAPI side.
   */
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${API_URL}/:path*`,
      },
      {
        source: "/ws/:path*",
        destination: `${API_URL}/ws/:path*`,
      },
    ];
  },
};

export default nextConfig;
