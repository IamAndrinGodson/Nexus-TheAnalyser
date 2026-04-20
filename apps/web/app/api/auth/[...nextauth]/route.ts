import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

// Trick NextAuth into inherently trusting the x-forwarded-host header from Ngrok
process.env.VERCEL = "1";

const handler = async (req: Request, res: any) => {
    // Dynamically override NEXTAUTH_URL to match the incoming Ngrok request origin
    // This prevents "authenticating forever" and CSRF token mismatches
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (host) {
        process.env.NEXTAUTH_URL = `${proto}://${host}`;
    }
    return NextAuth(authOptions)(req, res);
};

export { handler as GET, handler as POST };
