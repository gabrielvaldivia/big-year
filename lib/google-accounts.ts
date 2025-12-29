import { prisma } from "./prisma";

export type GoogleAccountRecord = {
  accountId: string;
  email?: string;
  accessToken: string;
  refreshToken?: string;
  accessTokenExpires?: number; // ms epoch
};

async function refreshGoogleAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return {
    accessToken: data.access_token as string,
    expiresAtMs: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600 * 1000),
    refreshToken: (data.refresh_token as string) || undefined,
  };
}

async function getGoogleEmail(accessToken: string): Promise<string | undefined> {
  try {
    // OpenID userinfo endpoint
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return data?.email as string | undefined;
    }
  } catch {}
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return data?.email as string | undefined;
    }
  } catch {}
  return undefined;
}

export async function getFreshGoogleAccountsForUser(userId: string): Promise<GoogleAccountRecord[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, provider: "google" },
    select: {
      providerAccountId: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });
  const now = Date.now() + 60_000;
  const records: GoogleAccountRecord[] = [];
  for (const a of accounts) {
    let accessToken = a.access_token || "";
    let refreshToken = a.refresh_token || undefined;
    let expiresAtMs = a.expires_at ? a.expires_at * 1000 : undefined;
    if ((!expiresAtMs || expiresAtMs < now) && refreshToken) {
      try {
        const refreshed = await refreshGoogleAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        expiresAtMs = refreshed.expiresAtMs;
        refreshToken = refreshed.refreshToken ?? refreshToken;
        // Persist refreshed tokens
        await prisma.account.update({
          where: { provider_providerAccountId: { provider: "google", providerAccountId: a.providerAccountId } },
          data: {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: Math.floor((expiresAtMs || 0) / 1000),
          },
        });
      } catch {
        // Keep old token; API calls may fail and return empty
      }
    }
    if (accessToken) {
      const email = await getGoogleEmail(accessToken).catch(() => undefined);
      records.push({
        accountId: a.providerAccountId,
        email,
        accessToken,
        refreshToken,
        accessTokenExpires: expiresAtMs,
      });
    }
  }
  return records;
}


