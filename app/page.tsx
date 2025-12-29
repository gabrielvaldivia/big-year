'use client';
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { YearCalendar, AllDayEvent } from "@/components/year-calendar";
import { ChevronLeft, ChevronRight, Unlink, Plus } from "lucide-react";

export default function HomePage() {
  const { data: session, status } = useSession();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [events, setEvents] = useState<AllDayEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [calendars, setCalendars] = useState<{ id: string; summary: string; primary?: boolean; backgroundColor?: string; accountEmail?: string }[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>({});
  const calendarsByEmail = useMemo(() => {
    const map = new Map<string, typeof calendars>();
    for (const c of calendars) {
      const key = c.accountEmail || "Other";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [calendars]);
  const calendarNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of calendars) {
      map[c.id] = c.summary;
    }
    return map;
  }, [calendars]);
  const calendarAccounts = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of calendars) {
      if (c.accountEmail) map[c.id] = c.accountEmail;
    }
    return map;
  }, [calendars]);

  useEffect(() => {
    if (status !== "authenticated") {
      setEvents([]);
      return;
    }
    const controller = new AbortController();
    const qs = `/api/events?year=${year}${
      selectedCalendarIds.length ? `&calendarIds=${encodeURIComponent(selectedCalendarIds.join(","))}` : ""
    }`;
    fetch(qs, { cache: "no-store", signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setEvents(data.events || []);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setEvents([]);
        }
      });
    return () => controller.abort();
  }, [status, year, selectedCalendarIds]);

  useEffect(() => {
    if (status !== "authenticated") {
      setCalendars([]);
      setSelectedCalendarIds([]);
      try { localStorage.removeItem("selectedCalendarIds"); } catch {}
      return;
    }
    fetch(`/api/calendars`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list = (data.calendars || []) as { id: string; summary: string; primary?: boolean; backgroundColor?: string; accountEmail?: string }[];
        setCalendars(list);
        // Restore previous selection; if none stored, default to all
        const allIds = list.map((c) => c.id);
        let prev: string[] = [];
        try {
          prev = JSON.parse(localStorage.getItem("selectedCalendarIds") || "[]") || [];
        } catch {}
        const restored =
          prev.length > 0 ? prev.filter((id) => allIds.includes(id)) : allIds;
        setSelectedCalendarIds(restored);
        // Load colors from localStorage, default to API backgroundColor or a soft palette
        try {
          const stored = JSON.parse(localStorage.getItem("calendarColors") || "{}");
          const next: Record<string, string> = { ...(stored || {}) };
          for (const c of list) {
            if (!next[c.id]) {
              next[c.id] = c.backgroundColor || "#cbd5e1"; // slate-300 fallback
            }
          }
          setCalendarColors(next);
          localStorage.setItem("calendarColors", JSON.stringify(next));
        } catch {
          const next: Record<string, string> = {};
          for (const c of list) next[c.id] = c.backgroundColor || "#cbd5e1";
          setCalendarColors(next);
          localStorage.setItem("calendarColors", JSON.stringify(next));
        }
      })
      .catch(() => {
        setCalendars([]);
        setSelectedCalendarIds([]);
        setCalendarColors({});
      });
  }, [status]);

  // Persist selection whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("selectedCalendarIds", JSON.stringify(selectedCalendarIds));
    } catch {}
  }, [selectedCalendarIds]);

  const onPrev = () => setYear((y) => y - 1);
  const onNext = () => setYear((y) => y + 1);
  const onRefresh = async () => {
    if (status !== "authenticated") {
      setEvents([]);
      return;
    }
    try {
      setIsRefreshing(true);
      // 1) Reload calendars from all linked accounts
      const calendarsRes = await fetch(`/api/calendars`, { cache: "no-store" });
      const calendarsData = await calendarsRes.json();
      const newCalendars = (calendarsData.calendars || []) as {
        id: string;
        summary: string;
        primary?: boolean;
        backgroundColor?: string;
        accountEmail?: string;
      }[];
      setCalendars(newCalendars);
      // Keep existing selection; don't auto-select new calendars
      const allIds = newCalendars.map((c) => c.id);
      const mergedSelected = selectedCalendarIds.filter((id) => allIds.includes(id));
      setSelectedCalendarIds(mergedSelected);
      try {
        localStorage.setItem("selectedCalendarIds", JSON.stringify(mergedSelected));
      } catch {}
      // Merge default colors for any new calendars
      const nextColors: Record<string, string> = { ...calendarColors };
      for (const c of newCalendars) {
        if (!nextColors[c.id]) nextColors[c.id] = c.backgroundColor || "#cbd5e1";
      }
      setCalendarColors(nextColors);
      try {
        localStorage.setItem("calendarColors", JSON.stringify(nextColors));
      } catch {}
      // 2) Reload events for the current year using the merged selection
      const qs = `/api/events?year=${year}${mergedSelected.length ? `&calendarIds=${encodeURIComponent(mergedSelected.join(","))}` : ""}`;
      const eventsRes = await fetch(qs, { cache: "no-store" });
      const eventsData = await eventsRes.json();
      setEvents(eventsData.events || []);
    } catch {
      // keep existing events on failure
    } finally {
      setIsRefreshing(false);
    }
  };
  const disconnectAccount = async (accountId: string) => {
    try {
      await fetch("/api/accounts/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      await onRefresh();
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col">
      <div className="grid grid-cols-3 items-center p-3 border-b">
        <div className="flex items-center gap-2">
          <Button variant="secondary" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
            ☰
          </Button>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" className="hover:bg-transparent" onClick={onPrev} aria-label="Previous year">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="font-semibold text-lg min-w-[5ch] text-center leading-none">{year}</div>
          <Button variant="ghost" size="icon" className="hover:bg-transparent" onClick={onNext} aria-label="Next year">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div />
      </div>
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-background/60 z-40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] bg-card border-r shadow-lg flex flex-col"
            role="dialog"
            aria-label="Menu"
          >
            <div className="p-3 border-b flex items-center justify-between">
              <div className="font-semibold">Calendars</div>
              <Button
                variant="ghost"
                size="icon"
                className="text-[24px] leading-none"
                aria-label="Refresh events"
                title={isRefreshing ? "Refreshing…" : "Refresh events"}
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                ⟳
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1">
              {status === "authenticated" ? (
                calendarsByEmail.map(([email, list]) => (
                  <div key={email} className="space-y-1">
                    <div className="px-2 pt-3 pb-1 flex items-center justify-between">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {email}
                      </div>
                      {list.length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          aria-label={`Disconnect ${email}`}
                          title={`Disconnect ${email}`}
                          onClick={() => {
                            const first = list[0];
                            const accountId = first.id.split("|")[0];
                            disconnectAccount(accountId);
                          }}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {list.map((c) => {
                      const checked = selectedCalendarIds.includes(c.id);
                      return (
                        <div key={c.id} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-accent">
                          <input
                            type="checkbox"
                            className="accent-foreground"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedCalendarIds((prev) =>
                                e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                              );
                            }}
                          />
                          <span className="truncate flex-1">{c.summary}</span>
                          {c.primary && <span className="text-[10px] text-muted-foreground">primary</span>}
                          <input
                            type="color"
                            value={calendarColors[c.id] || "#cbd5e1"}
                            onChange={(e) => {
                              const next = { ...calendarColors, [c.id]: e.target.value };
                              setCalendarColors(next);
                              try {
                                localStorage.setItem("calendarColors", JSON.stringify(next));
                              } catch {}
                            }}
                            className="h-5 w-5 rounded border p-0"
                            aria-label={`Color for ${c.summary}`}
                            title={`Color for ${c.summary}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground p-2">Sign in to manage calendars.</div>
              )}
              {status === "authenticated" && calendars.length === 0 && (
                <div className="text-sm text-muted-foreground p-2">No calendars</div>
              )}
              {status === "authenticated" && (
                <div className="px-2 py-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center gap-2"
                    onClick={() => {
                      import("next-auth/react").then(({ signIn }) =>
                        signIn("google", { callbackUrl: window.location.href })
                      );
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Google account</span>
                  </Button>
                </div>
              )}
            </div>
            <div className="p-3 border-t">
              {status === "authenticated" ? (
                <Button className="w-full" variant="outline" onClick={() => { setSidebarOpen(false); signOut(); }}>
                  Sign out
                </Button>
              ) : (
                <Button className="w-full" onClick={() => { setSidebarOpen(false); signIn("google"); }}>
                  Sign in with Google
                </Button>
              )}
            </div>
          </aside>
        </>
      )}
      <div className="flex-1 min-h-0">
        <YearCalendar
          year={year}
          events={events}
          signedIn={status === "authenticated"}
          calendarColors={calendarColors}
          calendarNames={calendarNames}
          calendarAccounts={calendarAccounts}
        />
      </div>
    </div>
  );
}


