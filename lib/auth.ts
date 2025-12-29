import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
// @ts-ignore - ESM interop
import { prisma } from "./prisma";

const GOOGLE_AUTHORIZATION_URL =
  "https://accounts.google.com/o/oauth2/v2/auth?prompt=consent&access_type=offline&response_type=code";

async function refreshAccessToken(token: any) {
  try {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken as string,
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return {
      ...token,
      accessToken: data.access_token,
      accessTokenExpires: Date.now() + data.expires_in * 1000,
      refreshToken: token.refreshToken ?? data.refresh_token,
    };
  } catch (e) {
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

async function refreshSingleGoogleAccount(account: any) {
  try {
    if (!account.refreshToken) return account;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: account.refreshToken as string,
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return {
      ...account,
      accessToken: data.access_token,
      accessTokenExpires: Date.now() + data.expires_in * 1000,
      refreshToken: account.refreshToken ?? data.refresh_token,
    };
  } catch (e) {
    return { ...account, error: "RefreshAccessTokenError" as const };
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        url: GOOGLE_AUTHORIZATION_URL,
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // When a (re)sign-in occurs, add/update this Google account in the token.googleAccounts array.
      if (account) {
        const expiresInSecRaw = (account as any)?.expires_in;
        const expiresInSec =
          typeof expiresInSecRaw === "number"
            ? expiresInSecRaw
            : typeof expiresInSecRaw === "string"
              ? parseInt(expiresInSecRaw, 10)
              : undefined;
        const acctId = account.providerAccountId as string;
        const existing = (token.googleAccounts as any[]) || [];
        const updated = existing.filter((a) => a.accountId !== acctId);
        updated.push({
          accountId: acctId,
          email: user?.email as string | undefined,
          accessToken: account.access_token as string,
          refreshToken: (account.refresh_token as string) || undefined,
          accessTokenExpires:
            Date.now() + (expiresInSec ? expiresInSec * 1000 : 3600 * 1000),
        });
        token.googleAccounts = updated;
        // Keep backward compat single-token fields to the latest account
        token.accessToken = account.access_token as string;
        token.refreshToken = (account.refresh_token as string) || token.refreshToken;
        token.accessTokenExpires =
          Date.now() + (expiresInSec ? expiresInSec * 1000 : 3600 * 1000);
        token.user = user;
        return token;
      }
      // Refresh any google accounts that are expiring.
      if (Array.isArray(token.googleAccounts) && token.googleAccounts.length > 0) {
        const now = Date.now() + 60_000; // 1 min buffer
        const refreshed = await Promise.all(
          token.googleAccounts.map((a: any) =>
            a.accessTokenExpires && a.accessTokenExpires > now
              ? a
              : refreshSingleGoogleAccount(a)
          )
        );
        token.googleAccounts = refreshed;
        // Maintain single-token fields for convenience (use the first account)
        const first = refreshed[0];
        if (first) {
          token.accessToken = first.accessToken;
          token.refreshToken = first.refreshToken;
          token.accessTokenExpires = first.accessTokenExpires;
        }
        return token;
      }
      // Legacy single-account refresh
      if (Date.now() < (token.accessTokenExpires as number) - 60000) {
        return token;
      }
      return await refreshAccessToken(token);
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).googleAccounts = token.googleAccounts || [];
      (session as any).user = token.user;
      // Ensure session.user.id is present (Prisma adapter provides)
      return session;
    },
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};


