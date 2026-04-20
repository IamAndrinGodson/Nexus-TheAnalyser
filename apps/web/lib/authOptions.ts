import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                totp: { label: "TOTP Code", type: "text" },
            },
            async authorize(credentials) {
                if (!credentials) return null;

                const API_URL = process.env.RISK_API_URL || "http://localhost:8000";

                try {
                    const res = await fetch(`${API_URL}/api/auth/login`, {
                        method: "POST",
                        headers: { 
                            "Content-Type": "application/json",
                            "ngrok-skip-browser-warning": "1",
                        },
                        body: JSON.stringify({
                            email: credentials.email,
                            password: credentials.password,
                            totp_code: credentials.totp || null,
                        }),
                    });

                    // Defensive JSON parsing — handle HTML error pages from Ngrok/backend
                    const text = await res.text();
                    let data;
                    try {
                        data = JSON.parse(text);
                    } catch {
                        throw new Error("Backend returned a non-JSON response. Is the API server running?");
                    }

                    if (!res.ok) {
                        throw new Error(data.detail || "Authentication failed");
                    }

                    if (data.totp_required) {
                        throw new Error("TOTP_REQUIRED");
                    }

                    return {
                        id: data.user_id,
                        email: credentials.email,
                        role: data.role,
                        orgId: data.org_id,
                        backendToken: data.access_token,
                        sessionId: data.session_id,
                    };
                } catch (error: any) {
                    throw new Error(error.message);
                }
            },
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 4 * 60 * 60, // 4 hours maximum
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.userId = user.id;
                token.role = (user as any).role;
                token.orgId = (user as any).orgId;
                token.sessionId = (user as any).sessionId;
                token.backendToken = (user as any).backendToken;
            }
            return token;
        },
        async session({ session, token }) {
            (session as any).user.id = token.userId as string;
            (session as any).user.role = token.role as string;
            (session as any).sessionId = token.sessionId as string;
            (session as any).backendToken = token.backendToken as string;
            return session;
        },
    },
    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },
};
