'use client';
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { YearCalendar, AllDayEvent } from "@/components/year-calendar";
import { ChevronLeft, ChevronRight, Unlink, Plus } from "lucide-react";

type CalendarListItem = {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  accountEmail?: string;
  accessRole?: string;
};

function isoDateOnlyFromDate(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [events, setEvents] = useState<AllDayEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [calendars, setCalendars] = useState<CalendarListItem[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>({});
  const [hiddenEventIds, setHiddenEventIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState<string>("");
  const [createStartDate, setCreateStartDate] = useState<string>("");
  const [createHasEndDate, setCreateHasEndDate] = useState<boolean>(false);
  const [createEndDate, setCreateEndDate] = useState<string>("");
  const [createCalendarId, setCreateCalendarId] = useState<string>("");
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>("");
  const writableCalendars = useMemo(() => {
    const canWrite = new Set(["owner", "writer"]);
    return calendars.filter((c) => (c.accessRole ? canWrite.has(c.accessRole) : false));
  }, [calendars]);
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

  // Load hidden events from storage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("hiddenEventIds") || "[]");
      if (Array.isArray(stored)) setHiddenEventIds(stored);
    } catch {}
  }, []);
  // Persist hidden events
  useEffect(() => {
    try {
      localStorage.setItem("hiddenEventIds", JSON.stringify(hiddenEventIds));
    } catch {}
  }, [hiddenEventIds]);

  const visibleEvents = useMemo(() => {
    if (showHidden) return events;
    return events.filter((e) => !hiddenEventIds.includes(e.id));
  }, [events, hiddenEventIds, showHidden]);

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
        const list = (data.calendars || []) as CalendarListItem[];
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

  useEffect(() => {
    if (!createOpen) return;
    setCreateError("");
    setCreateTitle("");
    setCreateHasEndDate(false);
    setCreateEndDate("");
    const now = new Date();
    const defaultDate = now.getFullYear() === year ? now : new Date(year, 0, 1);
    setCreateStartDate(isoDateOnlyFromDate(defaultDate));
    // Prefer a writable primary calendar; else first writable; else first overall.
    const primaryWritable = writableCalendars.find((c) => c.primary)?.id;
    const firstWritable = writableCalendars[0]?.id;
    const firstAny = calendars[0]?.id;
    setCreateCalendarId(primaryWritable || firstWritable || firstAny || "");
  }, [createOpen, calendars, writableCalendars, year]);

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

  const onCreateEvent = async () => {
    if (status !== "authenticated") return;
    setCreateError("");
    if (!createTitle.trim()) {
      setCreateError("Title is required.");
      return;
    }
    if (!createStartDate) {
      setCreateError("Date is required.");
      return;
    }
    if (!createCalendarId) {
      setCreateError("Calendar is required.");
      return;
    }
    if (createHasEndDate && createEndDate && createEndDate < createStartDate) {
      setCreateError("End date must be on/after start date.");
      return;
    }
    try {
      setCreateSubmitting(true);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          startDate: createStartDate,
          endDate: createHasEndDate ? (createEndDate || createStartDate) : undefined,
          calendarId: createCalendarId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError((data && data.error) || "Failed to create event.");
        return;
      }
      setCreateOpen(false);
      await onRefresh();
    } catch {
      setCreateError("Failed to create event.");
    } finally {
      setCreateSubmitting(false);
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
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => setCreateOpen(true)}
            disabled={status !== "authenticated"}
            aria-label="Create event"
            title={status === "authenticated" ? "Create event" : "Sign in to create events"}
          >
            <Plus className="h-4 w-4" />
            <span>Create event</span>
          </Button>
        </div>
      </div>
      {createOpen && (
        <>
          <div
            className="fixed inset-0 bg-background/60 z-40"
            onClick={() => (createSubmitting ? null : setCreateOpen(false))}
            aria-hidden
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-label="Create event"
          >
            <div className="w-full max-w-md rounded-md border bg-card shadow-lg">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="font-semibold">Create event</div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[22px] leading-none"
                  onClick={() => (createSubmitting ? null : setCreateOpen(false))}
                  aria-label="Close"
                  disabled={createSubmitting}
                >
                  ×
                </Button>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Title</label>
                  <input
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="Event title"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    disabled={createSubmitting}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Date</label>
                  <input
                    type="date"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={createStartDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCreateStartDate(v);
                      if (createHasEndDate && createEndDate && v && createEndDate < v) {
                        setCreateEndDate(v);
                      }
                    }}
                    disabled={createSubmitting}
                  />
                  <div className="text-xs text-muted-foreground">Defaults to all-day.</div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Calendar</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={createCalendarId}
                    onChange={(e) => setCreateCalendarId(e.target.value)}
                    disabled={createSubmitting}
                  >
                    {(writableCalendars.length ? writableCalendars : calendars).map((c) => (
                      <option key={c.id} value={c.id}>
                        {(c.accountEmail ? `${c.accountEmail} — ` : "") + c.summary}
                      </option>
                    ))}
                  </select>
                  {writableCalendars.length === 0 && calendars.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      No writable calendars found; creating may fail on read-only calendars.
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={createHasEndDate}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setCreateHasEndDate(on);
                        if (on && !createEndDate) setCreateEndDate(createStartDate);
                        if (!on) setCreateEndDate("");
                      }}
                      disabled={createSubmitting}
                    />
                    <span className="font-medium">Add end date</span>
                  </label>
                  {createHasEndDate && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">End date</label>
                      <input
                        type="date"
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={createEndDate}
                        min={createStartDate || undefined}
                        onChange={(e) => setCreateEndDate(e.target.value)}
                        disabled={createSubmitting}
                      />
                      <div className="text-xs text-muted-foreground">
                        End date is inclusive (we’ll convert it correctly for Google Calendar).
                      </div>
                    </div>
                  )}
                </div>
                {createError && (
                  <div className="text-sm text-destructive">{createError}</div>
                )}
              </div>
              <div className="p-4 border-t flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={createSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={onCreateEvent} disabled={createSubmitting || status !== "authenticated"}>
                  {createSubmitting ? "Creating…" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
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
              {status === "authenticated" && hiddenEventIds.length > 0 && (
                <label className="px-2 pt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-foreground"
                    checked={showHidden}
                    onChange={(e) => setShowHidden(e.target.checked)}
                  />
                  <span>Show hidden events</span>
                </label>
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
          events={visibleEvents}
          signedIn={status === "authenticated"}
          calendarColors={calendarColors}
          calendarNames={calendarNames}
          calendarAccounts={calendarAccounts}
          onHideEvent={(id) => {
            setHiddenEventIds((prev) =>
              prev.includes(id) ? prev : [...prev, id]
            );
          }}
        />
      </div>
    </div>
  );
}


