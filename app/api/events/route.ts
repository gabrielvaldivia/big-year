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

function isIsoDateOnly(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDaysIsoDateOnly(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map((p) => parseInt(p, 10));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = `${dt.getUTCMonth() + 1}`.padStart(2, "0");
  const dd = `${dt.getUTCDate()}`.padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
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
  if (!(session as any)?.user?.id) {
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!(session as any)?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const calendarIdComposite = typeof body?.calendarId === "string" ? body.calendarId.trim() : "";
  const startDate = body?.startDate;
  const endDate = body?.endDate; // inclusive, optional

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!calendarIdComposite.includes("|")) {
    return NextResponse.json({ error: "calendarId is required" }, { status: 400 });
  }
  if (!isIsoDateOnly(startDate)) {
    return NextResponse.json({ error: "startDate must be YYYY-MM-DD" }, { status: 400 });
  }
  if (endDate != null && !isIsoDateOnly(endDate)) {
    return NextResponse.json({ error: "endDate must be YYYY-MM-DD" }, { status: 400 });
  }
  if (isIsoDateOnly(endDate) && endDate < startDate) {
    return NextResponse.json({ error: "endDate must be on/after startDate" }, { status: 400 });
  }

  const [accountId, calendarId] = calendarIdComposite.split("|");
  if (!accountId || !calendarId) {
    return NextResponse.json({ error: "Invalid calendarId" }, { status: 400 });
  }

  const accounts = await getFreshGoogleAccountsForUser((session as any).user.id as string);
  const account = accounts.find((a) => a.accountId === accountId);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Google all-day events require end.date to be exclusive.
  // UI sends endDate as inclusive; convert to exclusive.
  const endExclusive = addDaysIsoDateOnly(isIsoDateOnly(endDate) ? endDate : startDate, 1);

  const createUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId
  )}/events`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: title,
      start: { date: startDate },
      end: { date: endExclusive },
    }),
    cache: "no-store",
  });

  if (!createRes.ok) {
    let errText = "Failed to create event";
    try {
      const errJson = await createRes.json();
      errText = errJson?.error?.message || errJson?.error_description || errText;
    } catch {}
    return NextResponse.json({ error: errText }, { status: createRes.status });
  }

  const created = await createRes.json();
  return NextResponse.json({
    event: {
      id: `${accountId}|${calendarId}:${created.id as string}`,
      calendarId: `${accountId}|${calendarId}`,
      summary: (created.summary as string) || title,
      startDate,
      endDate: endExclusive,
    },
  });
}


