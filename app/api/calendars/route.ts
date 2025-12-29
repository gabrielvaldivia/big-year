import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFreshGoogleAccountsForUser } from "@/lib/google-accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ calendars: [] }, { status: 200 });
  }
  const accounts = await getFreshGoogleAccountsForUser((session as any).user.id as string);
  if (accounts.length === 0) {
    return NextResponse.json({ calendars: [] }, { status: 200 });
  }
  const fetches = accounts.map(async (acc: any) => {
    const url =
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=250";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${acc.accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return { items: [] as any[] };
    const data = await res.json();
    return { items: data.items || [], accountId: acc.accountId, email: acc.email };
  });
  const results = await Promise.all(fetches);
  const calendars = results.flatMap((r) =>
    (r.items || []).map((c: any) => ({
      id: `${r.accountId}|${c.id as string}`,
      originalId: c.id as string,
      accountId: r.accountId,
      accountEmail: r.email,
      summary: (c.summary as string) || "(Untitled)",
      primary: !!c.primary,
      backgroundColor: c.backgroundColor as string | undefined,
      accessRole: c.accessRole as string | undefined,
    }))
  );
  return NextResponse.json({ calendars });
}

