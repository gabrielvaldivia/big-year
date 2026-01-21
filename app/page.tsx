"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { YearCalendar, AllDayEvent } from "@/components/year-calendar";
import {
  ChevronLeft,
  ChevronRight,
  Unlink,
  Plus,
  RefreshCcw,
  Settings,
  X,
  Clock,
  Calendar as CalendarIcon,
  Trash2,
} from "lucide-react";
import { formatDateKey, cn } from "@/lib/utils";
import { CalendarListItem } from "@/types/calendar";
import { useTheme } from "@/components/theme-provider";

type LinkedAccount = {
  accountId: string;
  email?: string;
  status?: number;
  error?: string;
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const { theme } = useTheme();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [events, setEvents] = useState<AllDayEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [calendars, setCalendars] = useState<CalendarListItem[]>([]);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] =
    useState<boolean>(false);
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>(
    {}
  );
  const [hiddenEventIds, setHiddenEventIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [showDaysOfWeek, setShowDaysOfWeek] = useState<boolean>(false);
  const [alignWeekends, setAlignWeekends] = useState<boolean>(false);
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState<string>("");
  const [createStartDate, setCreateStartDate] = useState<string>("");
  const [createHasEndDate, setCreateHasEndDate] = useState<boolean>(false);
  const [createEndDate, setCreateEndDate] = useState<string>("");
  const [createCalendarId, setCreateCalendarId] = useState<string>("");
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>("");
  const createDateFromDayClick = useRef<string | null>(null);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);
  const preferencesLoaded = useRef<boolean>(false);
  const [preferencesLoadedState, setPreferencesLoadedState] =
    useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const createModalRef = useRef<HTMLDivElement | null>(null);
  const [createDragOffset, setCreateDragOffset] = useState<number>(0);
  const [createIsDragging, setCreateIsDragging] = useState<boolean>(false);
  const [createIsAnimatingIn, setCreateIsAnimatingIn] =
    useState<boolean>(false);
  const createDragStartY = useRef<number>(0);
  const createDragStartOffset = useRef<number>(0);
  const [showHeaderBorder, setShowHeaderBorder] = useState<boolean>(false);
  const scrollableContainerRef = useRef<HTMLDivElement | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState<boolean>(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState<string>("");
  const [deleteAccountSubmitting, setDeleteAccountSubmitting] = useState<boolean>(false);

  const mergeCalendarColorsWithDefaults = (
    calendars: CalendarListItem[],
    existingColors: Record<string, string>
  ): Record<string, string> => {
    const next: Record<string, string> = { ...existingColors };
    for (const c of calendars) {
      if (!next[c.id]) {
        next[c.id] = c.backgroundColor || "#cbd5e1";
      }
    }
    return next;
  };

  const groupCalendarsByAccount = (
    calendars: CalendarListItem[],
    accounts: LinkedAccount[]
  ): Array<{ accountId: string; email: string; list: CalendarListItem[] }> => {
    if (accounts.length > 0) {
      return accounts.map((acc) => ({
        accountId: acc.accountId,
        email: acc.email || "Other",
        list: calendars.filter((c) => c.id.startsWith(`${acc.accountId}|`)),
      }));
    }
    // Fallback grouping if accounts not provided
    const map = new Map<string, CalendarListItem[]>();
    const emailByAcc = new Map<string, string>();
    for (const c of calendars) {
      const accId = c.id.includes("|") ? c.id.split("|")[0] : "";
      const email = c.accountEmail || "Other";
      emailByAcc.set(accId, email);
      const key = accId || email;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([key, list]) => ({
      accountId: key,
      email: emailByAcc.get(key) || "Other",
      list,
    }));
  };

  const extractAccountIdFromCalendarId = (calendarId: string): string => {
    return calendarId.includes("|") ? calendarId.split("|")[0] : "";
  };

  const getAccountIdsFromCalendars = (
    calendars: CalendarListItem[]
  ): string[] => {
    return Array.from(
      new Set(
        calendars
          .map((c) => extractAccountIdFromCalendarId(c.id))
          .filter(Boolean)
      )
    );
  };

  const handleLinkingReturnCalendarSelection = (
    list: CalendarListItem[],
    selectedCalendarIds: string[],
    allIds: string[]
  ): string[] => {
    let beforeIds: string[] = [];
    try {
      beforeIds =
        JSON.parse(localStorage.getItem("preLinkAccountIds") || "[]") || [];
    } catch {}
    const beforeSet = new Set(beforeIds);
    const currentAccountIds = getAccountIdsFromCalendars(list);
    const newAccountIdSet = new Set(
      currentAccountIds.filter((id) => !beforeSet.has(id))
    );
    const currentFiltered = selectedCalendarIds.filter((id) =>
      allIds.includes(id)
    );
    const toAdd = list
      .filter((c) => {
        const accId = extractAccountIdFromCalendarId(c.id);
        return accId && newAccountIdSet.has(accId);
      })
      .map((c) => c.id);
    return Array.from(new Set([...currentFiltered, ...toAdd]));
  };

  const handleNormalLoadCalendarSelection = (
    list: CalendarListItem[],
    selectedCalendarIds: string[],
    allIds: string[],
    preferencesLoaded: boolean
  ): string[] => {
    const validCurrent = selectedCalendarIds.filter((id) =>
      allIds.includes(id)
    );

    // Check for new accounts
    const currentAccIds = new Set(
      validCurrent
        .map((id) => extractAccountIdFromCalendarId(id))
        .filter(Boolean)
    );
    const allAccIds = getAccountIdsFromCalendars(list);
    const newAccIds = allAccIds.filter((id) => !currentAccIds.has(id));

    if (preferencesLoaded) {
      // Preferences loaded - filter invalid and add new accounts
      if (newAccIds.length > 0) {
        const toAdd = list
          .filter((c) => {
            const accId = extractAccountIdFromCalendarId(c.id);
            return accId && newAccIds.includes(accId);
          })
          .map((c) => c.id);
        return Array.from(new Set([...validCurrent, ...toAdd]));
      } else {
        // Just filter invalid calendars
        return validCurrent;
      }
    } else {
      // Preferences not loaded yet - first time user, auto-select all
      return allIds;
    }
  };

  const writableCalendars = useMemo(() => {
    const canWrite = new Set(["owner", "writer"]);
    return calendars.filter((c) =>
      c.accessRole ? canWrite.has(c.accessRole) : false
    );
  }, [calendars]);
  const writableAccountsWithCalendars = useMemo(() => {
    const grouped = groupCalendarsByAccount(writableCalendars, accounts);
    return grouped.filter((group) => group.list.length > 0);
  }, [writableCalendars, accounts]);
  const accountsWithCalendars = useMemo(() => {
    return groupCalendarsByAccount(calendars, accounts);
  }, [accounts, calendars]);
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

  // Load preferences from server when authenticated
  useEffect(() => {
    if (status === "authenticated" && !preferencesLoaded.current) {
      fetch("/api/preferences")
        .then((res) => res.json())
        .then((data) => {
          // Only mark as loaded after successfully fetching preferences
          preferencesLoaded.current = true;
          setPreferencesLoadedState(true);
          if (data.selectedCalendarIds !== undefined) {
            setSelectedCalendarIds(data.selectedCalendarIds);
          }
          if (data.hiddenEventIds !== undefined) {
            setHiddenEventIds(data.hiddenEventIds);
          }
          if (data.showDaysOfWeek !== undefined) {
            setShowDaysOfWeek(data.showDaysOfWeek);
          }
          if (data.alignWeekends !== undefined) {
            setAlignWeekends(data.alignWeekends);
          }
          if (data.showHidden !== undefined) {
            setShowHidden(data.showHidden);
          }
          if (data.calendarColors !== undefined) {
            setCalendarColors(data.calendarColors);
          }
        })
        .catch((err) => {
          console.error("Failed to load preferences:", err);
          preferencesLoaded.current = false;
          setPreferencesLoadedState(false);
        });
    } else if (status !== "authenticated") {
      preferencesLoaded.current = false;
      setPreferencesLoadedState(false);
    }
  }, [status]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Header border on scroll
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!scrollableContainerRef.current) return;

    const container = scrollableContainerRef.current;
    // Find the scrollable element inside (YearCalendar's internal div with overflow-y-auto)
    const scrollableElement = container.querySelector(
      '[class*="overflow-y-auto"]'
    ) as HTMLElement;
    if (!scrollableElement) return;

    const handleScroll = () => {
      const scrollTop = scrollableElement.scrollTop;
      const scrollHeight = scrollableElement.scrollHeight;
      const clientHeight = scrollableElement.clientHeight;
      const hasScrolled = scrollTop > 0;
      const hasMoreContent = scrollHeight > clientHeight;
      setShowHeaderBorder(hasScrolled && hasMoreContent);
    };

    // Check initial state
    handleScroll();

    scrollableElement.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    // Also listen to resize in case content changes
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      scrollableElement.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [status, year, selectedCalendarIds]);

  // Animate create modal in from bottom on mobile
  useEffect(() => {
    if (createOpen && isMobile) {
      setCreateIsAnimatingIn(true);
      setCreateIsDragging(false);
      setCreateDragOffset(
        typeof window !== "undefined" ? window.innerHeight : 1000
      );
      const timeout = setTimeout(() => {
        setCreateDragOffset(0);
        setTimeout(() => setCreateIsAnimatingIn(false), 300);
      }, 10);
      return () => clearTimeout(timeout);
    } else if (!createOpen) {
      setCreateDragOffset(0);
      setCreateIsDragging(false);
      setCreateIsAnimatingIn(false);
    }
  }, [createOpen, isMobile]);

  // Add non-passive touch event listeners for drag-to-dismiss
  useEffect(() => {
    if (!isMobile || !createModalRef.current) return;

    const modal = createModalRef.current;
    const headerHeight = 80;

    const handleTouchStart = (e: TouchEvent) => {
      if (createSubmitting) return;
      const touch = e.touches[0];
      const target = e.target as HTMLElement;

      const isHeaderElement =
        target.closest('[aria-label="Close"]') ||
        target.closest("button[class*='p-1']");

      // Don't start dragging if clicking a button
      if (isHeaderElement) return;

      const rect = modal.getBoundingClientRect();
      const touchY = touch.clientY - rect.top;
      const scrollTop = modal.scrollTop;

      const isInHeader = touchY < headerHeight && scrollTop === 0;

      if (isInHeader) {
        setCreateIsDragging(true);
        createDragStartY.current = touch.clientY;
        createDragStartOffset.current = createDragOffset;
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!createIsDragging || createSubmitting) return;
      const touch = e.touches[0];
      const deltaY = touch.clientY - createDragStartY.current;
      const newOffset = Math.max(0, createDragStartOffset.current + deltaY);
      setCreateDragOffset(newOffset);
      e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!createIsDragging) return;
      const target = e.target as HTMLElement;
      const isHeaderElement =
        target.closest('[aria-label="Close"]') ||
        target.closest("button[class*='p-1']");

      setCreateIsDragging(false);

      const threshold = Math.min(100, window.innerHeight * 0.2);
      if (createDragOffset > threshold) {
        setCreateOpen(false);
        setTimeout(() => setCreateDragOffset(0), 300);
      } else {
        setCreateDragOffset(0);
      }

      // Don't prevent default if clicking a button, so onClick can fire
      if (!isHeaderElement) {
        e.preventDefault();
      }
    };

    modal.addEventListener("touchstart", handleTouchStart, { passive: false });
    modal.addEventListener("touchmove", handleTouchMove, { passive: false });
    modal.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      modal.removeEventListener("touchstart", handleTouchStart);
      modal.removeEventListener("touchmove", handleTouchMove);
      modal.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    isMobile,
    createSubmitting,
    createIsDragging,
    createDragOffset,
    createOpen,
  ]);

  // Handle calendar selection when both calendars and preferences are loaded
  // This runs when preferences finish loading (if calendars are already loaded)
  // or when calendars finish loading (if preferences are already loaded)
  const processedCalendarSelectionRef = useRef<boolean>(false);
  useEffect(() => {
    if (
      status === "authenticated" &&
      preferencesLoadedState &&
      calendars.length > 0 &&
      !processedCalendarSelectionRef.current
    ) {
      processedCalendarSelectionRef.current = true;
      const allIds = calendars.map((c) => c.id);

      // Check if we have a saved selection from preferences
      // selectedCalendarIds from preferences will be set when preferences load
      // We need to check the actual state at this point
      const currentSelection = selectedCalendarIds;

      // If we have no saved selection (empty array), auto-select all for first-time user
      if (currentSelection.length === 0) {
        setSelectedCalendarIds(allIds);
      } else {
        // We have a saved selection - filter invalid and add new account calendars
        const validSelection = currentSelection.filter((id) =>
          allIds.includes(id)
        );
        // Check for new accounts and auto-add their calendars
        const currentAccIds = new Set(
          validSelection
            .map((id) => extractAccountIdFromCalendarId(id))
            .filter(Boolean)
        );
        const allAccIds = getAccountIdsFromCalendars(calendars);
        const newAccIds = allAccIds.filter((id) => !currentAccIds.has(id));
        if (newAccIds.length > 0) {
          const toAdd = calendars
            .filter((c) => {
              const accId = extractAccountIdFromCalendarId(c.id);
              return accId && newAccIds.includes(accId);
            })
            .map((c) => c.id);
          const newSelection = Array.from(
            new Set([...validSelection, ...toAdd])
          );
          setSelectedCalendarIds(newSelection);
        } else if (validSelection.length !== currentSelection.length) {
          // Just filter invalid calendars
          setSelectedCalendarIds(validSelection);
        }
      }
    }
    if (status !== "authenticated") {
      processedCalendarSelectionRef.current = false;
    }
  }, [status, preferencesLoadedState, calendars, selectedCalendarIds]);

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
      selectedCalendarIds.length
        ? `&calendarIds=${encodeURIComponent(selectedCalendarIds.join(","))}`
        : ""
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
      // Don't remove selectedCalendarIds from localStorage when signing out
      // so they persist when user signs back in
      return;
    }
    fetch(`/api/calendars`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        // Always update calendars list
        const list = (data.calendars || []) as CalendarListItem[];
        const accs = (data.accounts || []) as LinkedAccount[];
        setCalendars(list);
        if (Array.isArray(accs) && accs.length > 0) {
          setAccounts(accs);
        } else {
          // derive unique accounts from calendars
          const uniq = Array.from(
            new Map(
              list
                .map((c) => ({
                  accountId: c.id.includes("|") ? c.id.split("|")[0] : "",
                  email: c.accountEmail,
                }))
                .filter((x) => x.accountId)
                .map((x) => [x.accountId, x])
            ).values()
          );
          setAccounts(uniq);
        }
        // Handle calendar selection: filter invalid, add new account calendars
        const allIds = list.map((c) => c.id);
        const url =
          typeof window !== "undefined" ? new URL(window.location.href) : null;
        const isLinkingReturn =
          !!url && url.searchParams.get("linkingAccount") === "1";

        let newSelection: string[];
        if (isLinkingReturn) {
          // Linking return: add calendars from new accounts
          newSelection = handleLinkingReturnCalendarSelection(
            list,
            selectedCalendarIds,
            allIds
          );
          setSelectedCalendarIds(newSelection);
          // Cleanup
          try {
            localStorage.removeItem("preLinkAccountIds");
          } catch {}
          if (url) {
            url.searchParams.delete("linkingAccount");
            history.replaceState({}, "", url.toString());
          }
        } else {
          // Normal load: don't modify calendar selection here
          // Calendar selection is handled by the separate useEffect that runs
          // after both preferences and calendars are loaded
          // This prevents race conditions where calendars load before preferences
        }

        // Update calendar colors (merge with existing, add defaults for new calendars)
        const next = mergeCalendarColorsWithDefaults(list, calendarColors);
        if (JSON.stringify(next) !== JSON.stringify(calendarColors)) {
          setCalendarColors(next);
        }
      })
      .catch(() => {
        setCalendars([]);
        setSelectedCalendarIds([]);
        setCalendarColors({});
      });
  }, [status, preferencesLoadedState]);

  useEffect(() => {
    if (!createOpen) {
      // Clear date when dialog closes so it doesn't persist
      setCreateStartDate("");
      createDateFromDayClick.current = null;
      return;
    }
    setCreateError("");
    setCreateTitle("");
    setCreateHasEndDate(false);
    setCreateEndDate("");
    // Use date from day click if available, otherwise use default
    if (createDateFromDayClick.current) {
      setCreateStartDate(createDateFromDayClick.current);
      createDateFromDayClick.current = null;
    } else {
      const now = new Date();
      const defaultDate =
        now.getFullYear() === year ? now : new Date(year, 0, 1);
      setCreateStartDate(formatDateKey(defaultDate));
    }
    // Prefer a writable primary calendar; else first writable; else first overall.
    const primaryWritable = writableCalendars.find((c) => c.primary)?.id;
    const firstWritable = writableCalendars[0]?.id;
    const firstAny = calendars[0]?.id;
    setCreateCalendarId(primaryWritable || firstWritable || firstAny || "");
  }, [createOpen, calendars, writableCalendars, year]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && createOpen && !createSubmitting) {
        setCreateOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [createOpen, createSubmitting]);

  // Persist preferences to server whenever they change
  useEffect(() => {
    if (status === "authenticated" && preferencesLoaded.current) {
      // Debounce API calls to avoid too many requests
      const timeoutId = setTimeout(() => {
        fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedCalendarIds,
            hiddenEventIds,
            showDaysOfWeek,
            alignWeekends,
            showHidden,
            calendarColors,
          }),
        }).catch((err) => {
          console.error("Failed to save preferences:", err);
        });
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [
    status,
    selectedCalendarIds,
    hiddenEventIds,
    showDaysOfWeek,
    alignWeekends,
    showHidden,
    calendarColors,
  ]);

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
      const mergedSelected = selectedCalendarIds.filter((id) =>
        allIds.includes(id)
      );
      setSelectedCalendarIds(mergedSelected);
      // Merge default colors for any new calendars
      const nextColors = mergeCalendarColorsWithDefaults(
        newCalendars,
        calendarColors
      );
      setCalendarColors(nextColors);
      // 2) Reload events for the current year using the merged selection
      const qs = `/api/events?year=${year}${
        mergedSelected.length
          ? `&calendarIds=${encodeURIComponent(mergedSelected.join(","))}`
          : ""
      }`;
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
          endDate: createHasEndDate
            ? createEndDate || createStartDate
            : undefined,
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

  // Show public homepage when not authenticated
  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <Image
                  src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.png"}
                  alt="Year"
                  width={166}
                  height={45}
                  className="h-8 w-auto"
                  priority
                  key={theme}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => signIn("google")}
                  variant="outline"
                  size="lg"
                  className="rounded-full px-6"
                >
                  Sign in with Google
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 pt-16">
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <div className="text-center">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
                Your entire year,
                <br />
                <span className="text-muted-foreground">at a glance</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                Display your all-day events from Google Calendar in one elegant
                interface.{" "}
                <span className="hidden sm:inline">
                  Plan ahead with confidence, and never miss important dates.
                </span>
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <Button
                  onClick={() => signIn("google")}
                  size="lg"
                  className="text-lg px-8 py-6 rounded-full"
                >
                  Get Started
                </Button>
              </div>
              <div className="w-full mb-0 sm:mb-0">
                <div className="w-full rounded-lg overflow-hidden border border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] shadow-lg">
                  <Image
                    src={
                      theme === "dark"
                        ? "/hero-image-dark.png"
                        : "/hero-image-light.png"
                    }
                    alt="Big Year calendar application screenshot"
                    width={1858}
                    height={1180}
                    className="w-full h-auto"
                    priority
                  />
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <p className="text-sm text-muted-foreground">
                  Created by{" "}
                  <Link
                    href="https://www.gabrielvaldivia.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors underline underline-offset-4"
                  >
                    Gabriel Valdivia
                  </Link>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href="/privacy"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link
                  href="/terms"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Show calendar interface when authenticated
  return (
    <div className="h-screen w-screen flex flex-col">
      <div
        className={cn(
          "grid grid-cols-3 items-center p-3 bg-[hsl(0,0%,99%)] dark:bg-[hsl(0,0%,8%)]",
          showHeaderBorder &&
            "border-b border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)]"
        )}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
            className="text-2xl p-2 hover:bg-transparent"
          >
            ☰
          </Button>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent"
            onClick={onPrev}
            aria-label="Previous year"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="font-semibold text-lg min-w-[5ch] text-center leading-none">
            {year}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-transparent"
            onClick={onNext}
            aria-label="Next year"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-transparent hover:bg-[rgba(255,255,255,0.1)] dark:hover:bg-[rgba(255,255,255,0.1)]"
            onClick={() => setCreateOpen(true)}
            aria-label="Create event"
            title="Create event"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {createOpen && (
        <>
          {isMobile && (
            <div
              className="fixed inset-0 bg-background/60 z-40"
              onClick={() => {
                if (!createSubmitting) {
                  setCreateOpen(false);
                }
              }}
              aria-hidden
            />
          )}
          <div
            ref={createModalRef}
            className={cn(
              "border border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] bg-[hsl(0,0%,99%)] dark:bg-[hsl(0,0%,10%)] shadow-lg pointer-events-auto z-50",
              isMobile
                ? "fixed bottom-0 left-0 right-0 w-full rounded-t-3xl rounded-b-none max-h-[80vh] overflow-y-auto transition-transform"
                : "fixed rounded-md w-full max-w-md"
            )}
            style={
              isMobile
                ? {
                    transform: `translateY(${Math.max(0, createDragOffset)}px)`,
                    transition: createIsDragging
                      ? "none"
                      : createIsAnimatingIn
                      ? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                      : "transform 0.3s ease-out",
                  }
                : {
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    maxWidth: "400px",
                  }
            }
            role="dialog"
            aria-label="Create event"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "flex items-center justify-between",
                isMobile ? "px-6 pt-6 pb-4" : "px-4 pt-4 pb-2"
              )}
            >
              <div
                className={cn(
                  isMobile ? "text-lg font-semibold" : "font-semibold"
                )}
              >
                Event
              </div>
              <button
                className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!createSubmitting) {
                    setCreateOpen(false);
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="Close"
                disabled={createSubmitting}
              >
                <X className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
              </button>
            </div>
            <div
              className={cn(
                "space-y-3",
                isMobile ? "px-6 pb-4" : "px-4 pt-2 pb-4"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex-shrink-0 flex items-center justify-center text-muted-foreground",
                    isMobile ? "w-6 h-6" : "w-5 h-5"
                  )}
                >
                  <Plus className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                </div>
                <input
                  className={cn(
                    "flex-1 border-0 bg-transparent px-0 py-1 focus:outline-none focus:ring-0 placeholder:text-muted-foreground",
                    isMobile ? "text-base" : "text-sm"
                  )}
                  placeholder="Event title"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  disabled={createSubmitting}
                  autoFocus={!isMobile}
                />
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex-shrink-0 flex items-center justify-center text-muted-foreground",
                    isMobile ? "w-6 h-6" : "w-5 h-5"
                  )}
                >
                  <CalendarIcon
                    className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")}
                  />
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      ref={startDateInputRef}
                      type="date"
                      className={cn(
                        "border-0 bg-transparent px-0 py-1 focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
                        isMobile ? "text-base w-28" : "text-sm w-24"
                      )}
                      value={createStartDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCreateStartDate(v);
                        if (
                          createHasEndDate &&
                          createEndDate &&
                          v &&
                          createEndDate < v
                        ) {
                          setCreateEndDate(v);
                        }
                      }}
                      onClick={(e) => {
                        e.currentTarget.showPicker?.();
                        e.currentTarget.focus();
                      }}
                      disabled={createSubmitting}
                    />
                    {createHasEndDate && (
                      <>
                        <span className="text-muted-foreground">–</span>
                        <input
                          ref={endDateInputRef}
                          type="date"
                          className={cn(
                            "border-0 bg-transparent px-0 py-1 focus:outline-none focus:ring-0 ml-2 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
                            isMobile ? "text-base w-28" : "text-sm"
                          )}
                          value={createEndDate}
                          min={createStartDate || undefined}
                          onChange={(e) => setCreateEndDate(e.target.value)}
                          onClick={(e) => {
                            e.currentTarget.showPicker?.();
                            e.currentTarget.focus();
                          }}
                          disabled={createSubmitting}
                        />
                      </>
                    )}
                  </div>
                  {createHasEndDate ? (
                    <button
                      type="button"
                      className={cn(
                        "text-muted-foreground hover:text-foreground flex-shrink-0",
                        isMobile ? "p-1" : "text-xs"
                      )}
                      onClick={() => {
                        setCreateHasEndDate(false);
                        setCreateEndDate("");
                      }}
                      disabled={createSubmitting}
                      aria-label="Remove end date"
                    >
                      {isMobile ? <Trash2 className="h-5 w-5" /> : "Remove"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={cn(
                        "text-muted-foreground hover:text-foreground",
                        isMobile ? "text-sm" : "text-xs"
                      )}
                      onClick={() => {
                        setCreateHasEndDate(true);
                        if (!createEndDate) setCreateEndDate(createStartDate);
                      }}
                      disabled={createSubmitting}
                    >
                      Add end date
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex-shrink-0 flex items-center justify-center",
                    isMobile ? "w-6 h-6" : "w-5 h-5"
                  )}
                >
                  {createCalendarId && calendarColors[createCalendarId] ? (
                    <div
                      className={cn(
                        "rounded-full",
                        isMobile ? "w-5 h-5" : "w-3 h-3"
                      )}
                      style={{
                        backgroundColor: calendarColors[createCalendarId],
                      }}
                    />
                  ) : (
                    <div
                      className={cn(
                        "rounded-full bg-muted",
                        isMobile ? "w-5 h-5" : "w-3 h-3"
                      )}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <Select
                    value={createCalendarId}
                    onValueChange={setCreateCalendarId}
                    disabled={createSubmitting}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-full border-0 bg-transparent px-0 py-1 h-auto shadow-none focus:ring-0 justify-start gap-1",
                        isMobile ? "text-base" : "text-sm"
                      )}
                    >
                      <SelectValue placeholder="Select a calendar" />
                    </SelectTrigger>
                    <SelectContent>
                      {writableCalendars.length > 0
                        ? writableAccountsWithCalendars.map(
                            ({ accountId, email, list }) => (
                              <SelectGroup key={accountId || email}>
                                <SelectLabel>
                                  {email && email.length
                                    ? email
                                    : accountId || "Account"}
                                </SelectLabel>
                                {list.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.summary}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )
                          )
                        : calendars.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {(c.accountEmail ? `${c.accountEmail} — ` : "") +
                                c.summary}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {writableCalendars.length === 0 && calendars.length > 0 && (
                <div
                  className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-sm pl-8" : "text-xs pl-8"
                  )}
                >
                  No writable calendars found; creating may fail on read-only
                  calendars.
                </div>
              )}
              {createError && (
                <div
                  className={cn(
                    "text-destructive",
                    isMobile ? "text-base pl-8" : "text-sm pl-8"
                  )}
                >
                  {createError}
                </div>
              )}
            </div>
            <div
              className={cn(
                "flex gap-2 items-center",
                isMobile ? "px-6 pb-6" : "px-4 pb-4 justify-end"
              )}
            >
              <Button
                variant="outline"
                className={cn(
                  isMobile && "flex-1",
                  "bg-transparent border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)]"
                )}
                onClick={() => setCreateOpen(false)}
                disabled={createSubmitting}
              >
                Cancel
              </Button>
              <Button
                className={cn(isMobile && "flex-1")}
                onClick={onCreateEvent}
                disabled={
                  createSubmitting ||
                  status !== "authenticated" ||
                  !createTitle.trim()
                }
              >
                {createSubmitting ? "Creating…" : "Create"}
              </Button>
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
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] bg-[hsl(0,0%,99%)] dark:bg-[hsl(0,0%,10%)] border-r border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] shadow-lg flex flex-col"
            role="dialog"
            aria-label="Menu"
          >
            <div className="p-3 border-b border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] flex items-center justify-between relative">
              <div className="font-semibold">Calendars</div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground flex items-center justify-center"
                  aria-label="Refresh events"
                  title={isRefreshing ? "Refreshing…" : "Refresh events"}
                  onClick={onRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCcw className="h-4 w-4" />
                </Button>
                {status === "authenticated" && (
                  <div className="relative flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground flex items-center justify-center"
                      aria-label="Settings"
                      title="Settings"
                      onClick={() =>
                        setSettingsDropdownOpen(!settingsDropdownOpen)
                      }
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    {settingsDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setSettingsDropdownOpen(false)}
                          aria-hidden
                        />
                        <div className="absolute right-0 top-full mt-1 w-56 bg-[hsl(0,0%,99%)] dark:bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] rounded-md shadow-lg z-20 p-2 space-y-2">
                          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent p-2 rounded">
                            <input
                              type="checkbox"
                              className="accent-foreground"
                              checked={showDaysOfWeek}
                              onChange={(e) =>
                                setShowDaysOfWeek(e.target.checked)
                              }
                            />
                            <span>Show days of week</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent p-2 rounded">
                            <input
                              type="checkbox"
                              className="accent-foreground"
                              checked={alignWeekends}
                              onChange={(e) =>
                                setAlignWeekends(e.target.checked)
                              }
                            />
                            <span>Align weekends</span>
                          </label>
                          {hiddenEventIds.length > 0 && (
                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent p-2 rounded">
                              <input
                                type="checkbox"
                                className="accent-foreground"
                                checked={showHidden}
                                onChange={(e) =>
                                  setShowHidden(e.target.checked)
                                }
                              />
                              <span>Show hidden events</span>
                            </label>
                          )}
                          <div className="border-t border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] my-2" />
                          <Link
                            href="/privacy"
                            className="text-sm hover:bg-accent p-2 rounded w-full text-left block"
                            onClick={() => setSettingsDropdownOpen(false)}
                          >
                            Privacy Policy
                          </Link>
                          <Link
                            href="/terms"
                            className="text-sm hover:bg-accent p-2 rounded w-full text-left block"
                            onClick={() => setSettingsDropdownOpen(false)}
                          >
                            Terms of Service
                          </Link>
                          <button
                            className="text-sm hover:bg-accent p-2 rounded w-full text-left"
                            onClick={() => {
                              setSettingsDropdownOpen(false);
                              signOut();
                            }}
                          >
                            Sign out
                          </button>
                          <div className="border-t border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] my-2" />
                          <button
                            className="text-sm text-destructive hover:bg-accent p-2 rounded w-full text-left"
                            onClick={() => {
                              setSettingsDropdownOpen(false);
                              setDeleteAccountOpen(true);
                            }}
                          >
                            Delete account
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1">
              {status === "authenticated" ? (
                accountsWithCalendars.map(({ accountId, email, list }) => (
                  <div key={accountId || email} className="space-y-1">
                    <div className="px-2 pt-3 pb-1 flex items-center justify-between">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {email && email.length ? email : accountId || "Account"}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-foreground"
                        aria-label={`Disconnect ${email}`}
                        title={`Disconnect ${email}`}
                        onClick={() => {
                          disconnectAccount(accountId);
                        }}
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                    {list.map((c) => {
                      const checked = selectedCalendarIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 text-sm p-2 rounded hover:bg-accent"
                        >
                          <input
                            type="checkbox"
                            className="accent-foreground"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedCalendarIds((prev) =>
                                e.target.checked
                                  ? [...prev, c.id]
                                  : prev.filter((id) => id !== c.id)
                              );
                            }}
                          />
                          <span className="truncate flex-1">{c.summary}</span>
                          <input
                            type="color"
                            value={calendarColors[c.id] || "#cbd5e1"}
                            onChange={(e) => {
                              const next = {
                                ...calendarColors,
                                [c.id]: e.target.value,
                              };
                              setCalendarColors(next);
                            }}
                            className="h-4 w-4 rounded-full border-0 p-0 cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full"
                            style={{
                              backgroundColor:
                                calendarColors[c.id] || "#cbd5e1",
                            }}
                            aria-label={`Color for ${c.summary}`}
                            title={`Color for ${c.summary}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground p-2">
                  Sign in to manage calendars.
                </div>
              )}
              {status === "authenticated" && calendars.length === 0 && (
                <div className="text-sm text-muted-foreground p-2">
                  No calendars
                </div>
              )}
              {status === "authenticated" && (
                <div className="px-2 py-3">
                  <Button
                    variant="outline"
                    className="w-full justify-center gap-2 rounded-full bg-transparent hover:bg-[rgba(255,255,255,0.1)] dark:hover:bg-[rgba(255,255,255,0.1)]"
                    onClick={() => {
                      // Persist existing accountIds so we can auto-add the new account's calendars after linking
                      try {
                        const existing = Array.from(
                          new Set(accounts.map((a) => a.accountId))
                        ).filter(Boolean);
                        localStorage.setItem(
                          "preLinkAccountIds",
                          JSON.stringify(existing)
                        );
                      } catch {}
                      import("next-auth/react").then(({ signIn }) => {
                        const href = window.location.href;
                        const hasQuery = href.includes("?");
                        const callbackUrl = `${href}${
                          hasQuery ? "&" : "?"
                        }linkingAccount=1`;
                        signIn("google", { callbackUrl });
                      });
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Google account</span>
                  </Button>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
      {deleteAccountOpen && (
        <>
          <div
            className="fixed inset-0 bg-background/60 z-40"
            onClick={() => {
              if (!deleteAccountSubmitting) {
                setDeleteAccountOpen(false);
                setDeleteAccountConfirm("");
              }
            }}
            aria-hidden
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[hsl(0,0%,99%)] dark:bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] rounded-md shadow-lg z-50 p-6"
            role="dialog"
            aria-label="Delete account"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">Delete Account</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This action cannot be undone. This will permanently delete your
              account and all associated data, including:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside mb-4 space-y-1">
              <li>Your user profile information</li>
              <li>All linked Google accounts and OAuth tokens</li>
              <li>Your calendar preferences and settings</li>
            </ul>
            <p className="text-sm text-muted-foreground mb-4">
              Your calendar events in Google Calendar will not be affected.
            </p>
            <p className="text-sm font-medium mb-2">
              Type <span className="font-mono bg-muted px-1 rounded">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              className="w-full border border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] rounded px-3 py-2 bg-background mb-4 focus:outline-none focus:ring-2 focus:ring-foreground"
              value={deleteAccountConfirm}
              onChange={(e) => setDeleteAccountConfirm(e.target.value)}
              placeholder="DELETE"
              disabled={deleteAccountSubmitting}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteAccountOpen(false);
                  setDeleteAccountConfirm("");
                }}
                disabled={deleteAccountSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (deleteAccountConfirm !== "DELETE") return;
                  try {
                    setDeleteAccountSubmitting(true);
                    const res = await fetch("/api/account/delete", {
                      method: "POST",
                    });
                    if (!res.ok) {
                      throw new Error("Failed to delete account");
                    }
                    // Sign out and redirect to home
                    await signOut({ callbackUrl: "/" });
                  } catch (e) {
                    console.error("Error deleting account:", e);
                    alert("Failed to delete account. Please try again.");
                    setDeleteAccountSubmitting(false);
                  }
                }}
                disabled={
                  deleteAccountSubmitting || deleteAccountConfirm !== "DELETE"
                }
              >
                {deleteAccountSubmitting ? "Deleting…" : "Delete Account"}
              </Button>
            </div>
          </div>
        </>
      )}
      <div ref={scrollableContainerRef} className="flex-1 min-h-0">
        <YearCalendar
          year={year}
          events={visibleEvents}
          signedIn={status === "authenticated"}
          calendarColors={calendarColors}
          calendarNames={calendarNames}
          calendarAccounts={calendarAccounts}
          writableCalendars={writableCalendars}
          writableAccountsWithCalendars={writableAccountsWithCalendars}
          showDaysOfWeek={showDaysOfWeek}
          alignWeekends={alignWeekends}
          onDayClick={(dateKey) => {
            if (status === "authenticated") {
              createDateFromDayClick.current = dateKey;
              setCreateOpen(true);
            }
          }}
          onUpdateEvent={async (event) => {
            try {
              await fetch("/api/events", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: event.id,
                  title: event.title,
                  calendarId: event.calendarId,
                  startDate: event.startDate,
                  endDate: event.endDate,
                }),
              });
            } catch {}
            await onRefresh();
          }}
          onCreateEvent={async (event) => {
            try {
              await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: event.title,
                  calendarId: event.calendarId,
                  startDate: event.startDate,
                  endDate: event.endDate,
                }),
              });
            } catch {}
            await onRefresh();
          }}
          onDeleteEvent={async (id) => {
            try {
              await fetch("/api/events", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
              });
            } catch {}
            await onRefresh();
          }}
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
