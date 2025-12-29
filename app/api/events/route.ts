import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFreshGoogleAccountsForUser } from "@/lib/google-accounts";

export const dynamic = "force-dynamic";

function startOfYearIso(year: number) {
  return new Date(Date.UTC(year, 0, 1)).toISOString();
}
function endOfYearIso(year: number) {
  return new Date(Date.UTC(year + 1, 0, 1)).toISOString();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(
    searchParams.get("year") || `${new Date().getFullYear()}`,
    10
  );
  const calendarIdsParam = searchParams.get("calendarIds") || "";
  const calendarIds = calendarIdsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ events: [] }, { status: 200 });
  }

  const accounts = await getFreshGoogleAccountsForUser((session as any).user.id as string);
  if (accounts.length === 0) {
    return NextResponse.json({ events: [] }, { status: 200 });
  }

  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: startOfYearIso(year),
    timeMax: endOfYearIso(year),
    maxResults: "2500",
  });

  // calendarIds are composite: `${accountId}|${calendarId}`
  const idsByAccount = new Map<string, string[]>();
  if (calendarIds.length > 0) {
    for (const comp of calendarIds) {
      const [accId, calId] = comp.split("|");
      if (!accId || !calId) continue;
      const arr = idsByAccount.get(accId) ?? [];
      arr.push(calId);
      idsByAccount.set(accId, arr);
    }
  }
  const fetches: Promise<any>[] = [];
  for (const acc of accounts) {
    const cals =
      idsByAccount.size > 0
        ? idsByAccount.get(acc.accountId) || []
        : ["primary"];
    for (const calId of cals) {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calId
      )}/events?${params.toString()}`;
      fetches.push(
        fetch(url, {
          headers: { Authorization: `Bearer ${acc.accessToken}` },
          cache: "no-store",
        }).then(async (res) => {
          if (!res.ok) return { items: [], calendarId: calId, accountId: acc.accountId };
          const data = await res.json();
          return { items: data.items || [], calendarId: calId, accountId: acc.accountId };
        })
      );
    }
  }
 
  const results = await Promise.all(fetches);
  const events = results.flatMap((r) =>
    (r.items || [])
      .filter((e: any) => e?.start?.date && e.status !== "cancelled")
      .map((e: any) => ({
        id: `${r.accountId || "primary"}|${r.calendarId || "primary"}:${e.id}`,
        calendarId: `${r.accountId || "primary"}|${r.calendarId || "primary"}`,
        summary: e.summary || "(Untitled)",
        startDate: e.start.date as string,
        endDate: e.end?.date as string,
      }))
  );

  return NextResponse.json({ events });
}


