"use client";
import React, { useMemo } from "react";
import Link from "next/link";
import { cn, formatDateKey } from "@/lib/utils";
import {
  Calendar as CalendarIcon,
  X,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { signIn } from "next-auth/react";
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
import { AllDayEvent, CalendarListItem } from "@/types/calendar";

export type { AllDayEvent, CalendarListItem };
function expandEventsToDateMap(events: AllDayEvent[]) {
  const map = new Map<string, AllDayEvent[]>();
  for (const ev of events) {
    const start = new Date(ev.startDate + "T00:00:00Z");
    const end = new Date(ev.endDate + "T00:00:00Z"); // exclusive
    for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
      const local = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      );
      const key = formatDateKey(
        new Date(
          local.getUTCFullYear(),
          local.getUTCMonth(),
          local.getUTCDate()
        )
      );
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
  }
  return map;
}

function generateYearDays(year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const days: Array<{ key: string; date: Date }> = [];
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    days.push({ key: formatDateKey(date), date });
  }
  return days;
}

function computeSquareGridColumns(
  totalDays: number,
  width: number,
  height: number,
  gapPx = 1
) {
  if (width <= 0 || height <= 0) return { cols: 1, cell: 10 };
  let bestCols = 1;
  let bestCell = 0;
  const maxCols = Math.min(totalDays, Math.max(1, Math.floor(width))); // safe upper bound
  for (let cols = 1; cols <= maxCols; cols++) {
    const usableWidth = width - (cols - 1) * gapPx;
    const cellSize = Math.floor(usableWidth / cols);
    if (cellSize <= 0) break;
    const rows = Math.ceil(totalDays / cols);
    const totalHeight = rows * cellSize + (rows - 1) * gapPx;
    if (totalHeight <= height) {
      if (cellSize > bestCell) {
        bestCell = cellSize;
        bestCols = cols;
      }
    }
  }
  if (bestCell === 0) {
    // Fallback if nothing fit: pick minimal cell that fits width and let height scroll slightly
    const usableWidth = width - (bestCols - 1) * gapPx;
    bestCell = Math.max(10, Math.floor(usableWidth / bestCols));
  }
  return { cols: bestCols, cell: bestCell };
}

const monthShort = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const dayOfWeekShort = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function hexToRgba(hex: string, alpha = 0.35) {
  try {
    let h = hex.replace("#", "").trim();
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
    const a = Math.min(1, Math.max(0, alpha));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } catch {
    return hex;
  }
}

export function YearCalendar({
  year,
  events,
  signedIn,
  calendarColors = {},
  calendarNames = {},
  calendarAccounts = {},
  onHideEvent,
  onDeleteEvent,
  onDayClick,
  onUpdateEvent,
  onCreateEvent,
  writableCalendars = [],
  writableAccountsWithCalendars = [],
  showDaysOfWeek = false,
  alignWeekends = false,
}: {
  year: number;
  events: AllDayEvent[];
  signedIn: boolean;
  calendarColors?: Record<string, string>;
  calendarNames?: Record<string, string>;
  calendarAccounts?: Record<string, string>;
  onHideEvent?: (id: string) => void;
  onDeleteEvent?: (id: string) => Promise<void> | void;
  onDayClick?: (dateKey: string) => void;
  onUpdateEvent?: (event: {
    id: string;
    title: string;
    calendarId: string;
    startDate: string;
    endDate?: string;
  }) => Promise<void> | void;
  onCreateEvent?: (event: {
    title: string;
    calendarId: string;
    startDate: string;
    endDate?: string;
  }) => Promise<void> | void;
  writableCalendars?: CalendarListItem[];
  writableAccountsWithCalendars?: Array<{
    accountId: string;
    email: string;
    list: CalendarListItem[];
  }>;
  showDaysOfWeek?: boolean;
  alignWeekends?: boolean;
}) {
  const todayKey = formatDateKey(new Date());
  const dateMap = useMemo(() => expandEventsToDateMap(events), [events]);
  const rawDays = useMemo(() => generateYearDays(year), [year]);
  const days = useMemo(() => {
    if (!alignWeekends) return rawDays;

    // Find the Monday of the week containing January 1st
    const jan1 = new Date(year, 0, 1);
    const dayOfWeek = jan1.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    // Convert to Monday-based: Monday=0, Tuesday=1, ..., Sunday=6
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // End at December 31st (don't extend to next year)
    const dec31 = new Date(year, 11, 31);
    const lastDayOfWeek = dec31.getDay();
    // Convert to Monday-based: Monday=0, Tuesday=1, ..., Sunday=6
    // Calculate how many days after Dec 31 to complete the week (to Sunday)
    const daysToSunday = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;

    // Generate all days from Monday of Jan 1 week to Sunday of Dec 31 week
    // Use null for days before January 1st and after December 31st
    const result: Array<{ key: string; date: Date } | null> = [];
    const startDate = new Date(jan1);
    startDate.setDate(startDate.getDate() - daysFromMonday);
    const endDate = new Date(dec31);
    endDate.setDate(endDate.getDate() + daysToSunday);

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const date = new Date(d);
      // If date is before Jan 1 or after Dec 31, use null (empty cell)
      if (date < jan1 || date > dec31) {
        result.push(null);
      } else {
        result.push({ key: formatDateKey(date), date });
      }
    }

    return result;
  }, [rawDays, alignWeekends, year]);
  const dayIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    days.forEach((d, i) => {
      if (d !== null) {
        map.set(d.key, i);
      }
    });
    return map;
  }, [days]);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const [cellSizePx, setCellSizePx] = React.useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const [popover, setPopover] = React.useState<{
    event: AllDayEvent | null;
    x: number;
    y: number;
    creatingDateKey?: string;
    position?: { above: boolean; left: boolean };
  }>({ event: null, x: 0, y: 0 });
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [editTitle, setEditTitle] = React.useState<string>("");
  const [editCalendarId, setEditCalendarId] = React.useState<string>("");
  const [editStartDate, setEditStartDate] = React.useState<string>("");
  const [editHasEndDate, setEditHasEndDate] = React.useState<boolean>(false);
  const [editEndDate, setEditEndDate] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);
  const [menuPosition, setMenuPosition] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const menuButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const editStartDateInputRef = React.useRef<HTMLInputElement | null>(null);
  const editEndDateInputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragOffset, setDragOffset] = React.useState<number>(0);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [isAnimatingIn, setIsAnimatingIn] = React.useState<boolean>(false);
  const dragStartY = React.useRef<number>(0);
  const dragStartOffset = React.useRef<number>(0);

  // Important for hydration: start with a deterministic server/client match,
  // then compute real columns after mount to avoid style mismatches.
  const [gridDims, setGridDims] = React.useState<{
    cols: number;
    cell: number;
  }>(() => ({
    cols: 12,
    cell: 12,
  }));
  const [isMobile, setIsMobile] = React.useState<boolean>(false);

  // Calculate actual cell width for month name visibility check
  const cellWidth = React.useMemo(() => {
    if (cellSizePx.w > 0) return cellSizePx.w;
    if (alignWeekends && gridDims.cols > 0) {
      const gap = 1;
      const usableWidth =
        typeof window !== "undefined" ? window.innerWidth - 2 : 0;
      return Math.floor(
        (usableWidth - (gridDims.cols - 1) * gap) / gridDims.cols
      );
    }
    return gridDims.cell;
  }, [cellSizePx.w, gridDims.cols, gridDims.cell, alignWeekends]);

  React.useEffect(() => {
    function onResize() {
      const gap = 1;
      const minCellSize = 70; // Minimum cell size in pixels (to fit 3 events: 16 label + 3*16 events + 2 padding = 66px, rounded to 70px)
      const usableWidth = window.innerWidth - 2; // account for border
      const usableHeight = window.innerHeight - 2; // account for border
      const mobileBreakpoint = 768;
      const mobile = usableWidth < mobileBreakpoint;
      setIsMobile(mobile);

      if (alignWeekends) {
        // Dynamically calculate how many weeks can fit based on viewport width
        // Calculate maximum weeks that can fit with minimum cell size
        // Each week = 7 days, so columns = weeks * 7
        const maxCols = Math.floor((usableWidth + gap) / (minCellSize + gap));
        const maxWeeks = Math.floor(maxCols / 7);

        // Ensure at least 1 week, and cap at 4 weeks maximum
        const weeks = Math.max(1, Math.min(maxWeeks, 4));
        const cols = weeks * 7;

        // Calculate cell size based on the number of weeks
        const widthBasedCell = Math.max(
          minCellSize,
          Math.floor((usableWidth - (cols - 1) * gap) / cols)
        );
        const rows = Math.ceil(days.length / cols);
        const heightBasedCell = Math.max(
          minCellSize,
          Math.floor((usableHeight - (rows - 1) * gap) / rows)
        );
        // On desktop, use the smaller to ensure square cells; on mobile, allow flexibility
        const cellSize = mobile
          ? widthBasedCell
          : Math.min(widthBasedCell, heightBasedCell);
        setGridDims({ cols, cell: cellSize });
      } else {
        if (mobile) {
          // On mobile, prioritize fitting at least 7 days horizontally
          // Don't force square cells - allow taller cells if needed
          const minCols = 7; // At least 7 days (a week) must fit
          const maxCols = Math.floor((usableWidth + gap) / (minCellSize + gap));

          // Use at least 7 columns, or as many as fit
          const cols = Math.max(minCols, maxCols);

          // Calculate cell size based on width constraint (allow taller than wide)
          const cellSize = Math.max(
            minCellSize,
            Math.floor((usableWidth - (cols - 1) * gap) / cols)
          );

          setGridDims({ cols, cell: cellSize });
        } else {
          // On larger screens, ensure square cells
          const computed = computeSquareGridColumns(
            days.length,
            window.innerWidth,
            window.innerHeight
          );
          // Ensure minimum cell size is respected
          if (computed.cell < minCellSize) {
            // Recalculate with minimum cell size constraint
            const maxCols = Math.floor(
              (usableWidth + gap) / (minCellSize + gap)
            );

            // Calculate cell size based on width constraint
            const widthBasedCell =
              maxCols > 0
                ? Math.max(
                    minCellSize,
                    Math.floor((usableWidth - (maxCols - 1) * gap) / maxCols)
                  )
                : minCellSize;

            // Calculate cell size based on height constraint
            const rows = Math.ceil(days.length / maxCols);
            const heightBasedCell =
              rows > 0
                ? Math.max(
                    minCellSize,
                    Math.floor((usableHeight - (rows - 1) * gap) / rows)
                  )
                : minCellSize;

            // Use the smaller of the two to ensure square cells
            const cellSize = Math.min(widthBasedCell, heightBasedCell);

            setGridDims({ cols: maxCols || 1, cell: cellSize });
          } else {
            setGridDims(computed);
          }
        }
      }
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [days.length, alignWeekends]);
  React.useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const firstCell = grid.querySelector<HTMLElement>('[data-day-cell="1"]');
    if (firstCell) {
      const rect = firstCell.getBoundingClientRect();
      if (rect.width && rect.height) {
        setCellSizePx({ w: rect.width, h: rect.height });
      }
    }
  }, [gridDims.cols, gridDims.cell, year]);
  React.useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!popover.event && !popover.creatingDateKey) return;
      if (popoverRef.current && e.target instanceof Node) {
        if (!popoverRef.current.contains(e.target)) {
          setPopover({ event: null, x: 0, y: 0 });
          setIsEditing(false);
          setMenuOpen(false);
        }
      } else {
        setPopover({ event: null, x: 0, y: 0 });
        setIsEditing(false);
        setMenuOpen(false);
        setMenuPosition(null);
      }
      if (menuRef.current && e.target instanceof Node) {
        if (!menuRef.current.contains(e.target)) {
          setMenuOpen(false);
          setMenuPosition(null);
        }
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPopover({ event: null, x: 0, y: 0 });
        setIsEditing(false);
        setMenuOpen(false);
        setMenuPosition(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popover.event, popover.creatingDateKey, menuOpen]);

  React.useEffect(() => {
    if (popover.event) {
      // Initialize edit state when popover opens for editing
      setEditTitle(popover.event.summary);
      setEditCalendarId(popover.event.calendarId || "");
      setEditStartDate(popover.event.startDate);

      // Animate bottom sheet in from bottom on mobile
      if (isMobile) {
        setIsAnimatingIn(true);
        setIsDragging(false);
        // Start off-screen at bottom
        setDragOffset(
          typeof window !== "undefined" ? window.innerHeight : 1000
        );
        // Trigger animation to slide up after mount
        const timeout = setTimeout(() => {
          setDragOffset(0);
          setTimeout(() => setIsAnimatingIn(false), 300);
        }, 10);
        return () => clearTimeout(timeout);
      } else {
        setDragOffset(0);
        setIsDragging(false);
        setIsAnimatingIn(false);
      }
      // Check if event has an end date (endDate is exclusive, so if it's different from startDate + 1 day, it's a multi-day event)
      const start = new Date(popover.event.startDate + "T00:00:00Z");
      const end = new Date(popover.event.endDate + "T00:00:00Z");
      const daysDiff = Math.round(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff > 1) {
        setEditHasEndDate(true);
        // Convert exclusive endDate to inclusive for editing
        const endInclusive = new Date(end.getTime() - 86400000);
        const y = endInclusive.getUTCFullYear();
        const m = `${endInclusive.getUTCMonth() + 1}`.padStart(2, "0");
        const d = `${endInclusive.getUTCDate()}`.padStart(2, "0");
        setEditEndDate(`${y}-${m}-${d}`);
      } else {
        setEditHasEndDate(false);
        setEditEndDate("");
      }
    } else if (popover.creatingDateKey) {
      // Initialize create state when popover opens for creating
      setEditTitle("");
      setEditCalendarId("");
      setEditStartDate(popover.creatingDateKey);
      setEditHasEndDate(false);
      setEditEndDate("");

      // Animate bottom sheet in from bottom on mobile
      if (isMobile) {
        setIsAnimatingIn(true);
        setIsDragging(false);
        // Start off-screen at bottom
        setDragOffset(
          typeof window !== "undefined" ? window.innerHeight : 1000
        );
        // Trigger animation to slide up after mount
        const timeout = setTimeout(() => {
          setDragOffset(0);
          setTimeout(() => setIsAnimatingIn(false), 300);
        }, 10);
        return () => clearTimeout(timeout);
      } else {
        setDragOffset(0);
        setIsDragging(false);
        setIsAnimatingIn(false);
      }
    }
  }, [popover.event, popover.creatingDateKey, isMobile]);

  function calculatePopoverPosition(
  clickX: number,
  clickY: number,
  clickWidth: number,
  clickHeight: number,
  clickClientX?: number,
  clickClientY?: number
): { x: number; y: number; position: { above: boolean; left: boolean } } {
  const popoverWidth = 400; // max-w-md
  const popoverHeight = 300; // estimated height
  const padding = 2; // minimal spacing from click point
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 1080;

  // Use actual click coordinates if available, otherwise use center of cell
  const targetX = clickClientX !== undefined ? clickClientX : clickX + clickWidth / 2;
  const targetY = clickClientY !== undefined ? clickClientY : clickY + clickHeight / 2;

  // Determine horizontal position - check if we need to flip
  const spaceRight = viewportWidth - targetX;
  const spaceLeft = targetX;
  const left = spaceRight < popoverWidth && spaceLeft > spaceRight;

  // Determine vertical position - check if we need to flip
  const spaceBelow = viewportHeight - targetY;
  const spaceAbove = targetY;
  const above = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

  // Calculate final position - keep popover edge aligned with click point
  // Note: transform translateX(-100%) means right edge aligns with x, translateY(-100%) means bottom edge aligns with y
  let x: number;
  let y: number;

  if (left) {
    // Position to the left: align right edge of popover with click point (using translateX(-100%))
    x = targetX;
    // If popover would extend off left edge, adjust to keep it as close as possible
    if (x - popoverWidth < padding) {
      // Position so right edge is as close to click as possible while staying in bounds
      x = Math.min(targetX, padding + popoverWidth);
    }
  } else {
    // Position to the right: align left edge of popover with click point
    x = targetX + padding;
    // If popover would extend off right edge, adjust to keep it as close as possible
    if (x + popoverWidth > viewportWidth - padding) {
      // Position so left edge is as close to click as possible while staying in bounds
      x = Math.max(targetX - popoverWidth + padding, viewportWidth - popoverWidth - padding);
    }
  }

  if (above) {
    // Position above: align bottom edge of popover with click point (using translateY(-100%))
    y = targetY;
    // If popover would extend off top edge, adjust to keep it as close as possible
    if (y - popoverHeight < padding) {
      // Position so bottom edge is as close to click as possible while staying in bounds
      y = Math.min(targetY, padding + popoverHeight);
    }
  } else {
    // Position below: align top edge of popover with click point
    y = targetY + padding;
    // If popover would extend off bottom edge, adjust to keep it as close as possible
    if (y + popoverHeight > viewportHeight - padding) {
      // Position so top edge is as close to click as possible while staying in bounds
      y = Math.max(targetY - popoverHeight + padding, viewportHeight - popoverHeight - padding);
    }
  }

  // Final bounds check to ensure popover stays within viewport
  if (left) {
    // For left positioning, ensure right edge (x) doesn't go off right edge
    x = Math.min(x, viewportWidth - padding);
    // And ensure left edge (x - popoverWidth) doesn't go off left edge
    x = Math.max(x, padding + popoverWidth);
  } else {
    x = Math.max(padding, Math.min(x, viewportWidth - popoverWidth - padding));
  }

  if (above) {
    // For above positioning, ensure bottom edge (y) doesn't go off bottom edge
    y = Math.min(y, viewportHeight - padding);
    // And ensure top edge (y - popoverHeight) doesn't go off top edge
    y = Math.max(y, padding + popoverHeight);
  } else {
    y = Math.max(padding, Math.min(y, viewportHeight - popoverHeight - padding));
  }

  return { x, y, position: { above, left } };
}

function formatDisplayRange(startIsoDate: string, endIsoDate: string) {
    const start = new Date(startIsoDate + "T00:00:00");
    const end = new Date(endIsoDate + "T00:00:00"); // exclusive
    const endInclusive = new Date(end.getTime() - 86400000);
    const sameMonth =
      start.getFullYear() === endInclusive.getFullYear() &&
      start.getMonth() === endInclusive.getMonth();
    const optsDay: Intl.DateTimeFormatOptions = { day: "numeric" };
    const optsMon: Intl.DateTimeFormatOptions = { month: "short" };
    const optsYear: Intl.DateTimeFormatOptions = { year: "numeric" };
    if (start.toDateString() === endInclusive.toDateString()) {
      return `${start.toLocaleString(undefined, {
        ...optsMon,
        ...optsDay,
      })}, ${start.toLocaleString(undefined, optsYear)}`;
    }
    if (sameMonth) {
      return `${start.toLocaleString(undefined, {
        ...optsMon,
        ...optsDay,
      })}–${endInclusive.toLocaleString(
        undefined,
        optsDay
      )}, ${start.toLocaleString(undefined, optsYear)}`;
    }
    const left = `${start.toLocaleString(undefined, {
      ...optsMon,
      ...optsDay,
    })}, ${start.toLocaleString(undefined, optsYear)}`;
    const right = `${endInclusive.toLocaleString(undefined, {
      ...optsMon,
      ...optsDay,
    })}, ${endInclusive.toLocaleString(undefined, optsYear)}`;
    return `${left} – ${right}`;
  }

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden">
      <div className="relative min-h-full w-full">
        <div
          ref={gridRef}
          className="grid min-h-full w-full bg-border dark:!bg-[hsl(0,0%,12%)] p-px"
          suppressHydrationWarning
          style={{
            gridTemplateColumns: `repeat(${gridDims.cols}, 1fr)`,
            gridAutoRows: isMobile ? `${gridDims.cell}px` : "auto",
            gap: "1px",
          }}
        >
          {days.map((day, index) => {
            if (day === null) {
              // Empty cell for days before January 1st or after December 31st
              return (
                <div
                  key={`empty-${index}`}
                  data-day-cell="1"
                  className={cn(
                    "relative bg-muted/30 p-1 min-w-0 min-h-0 overflow-hidden",
                    !isMobile && "aspect-square"
                  )}
                />
              );
            }
            const { key, date } = day;
            const isToday = key === todayKey;
            const dayEvents = dateMap.get(key) || [];
            const isFirstOfMonth = date.getDate() === 1;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <div
                key={key}
                data-day-cell="1"
                className={cn(
                  "relative bg-background dark:!bg-[hsl(0,0%,6%)] p-1 min-w-0 min-h-0 overflow-hidden",
                  !isMobile && "aspect-square",
                  isWeekend &&
                    'bg-white dark:!bg-[hsl(0,0%,8%)] before:content-[""] before:absolute before:inset-0 before:bg-[rgba(0,0,0,0.02)] dark:before:bg-transparent before:pointer-events-none',
                  isToday && "ring-1 ring-primary",
                  isFirstOfMonth &&
                    "border-l-2 border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)]"
                )}
                title={date.toDateString()}
                onClick={(e) => {
                  // Event bars are in a separate overlay with pointer-events-auto,
                  // so clicks on them won't reach here. Only clicks on empty day areas will.
                  if (signedIn && onCreateEvent) {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const pos = calculatePopoverPosition(
                      rect.left,
                      rect.top,
                      rect.width,
                      rect.height,
                      e.clientX,
                      e.clientY
                    );
                    setPopover({
                      event: null,
                      x: pos.x,
                      y: pos.y,
                      creatingDateKey: key,
                      position: pos.position,
                    });
                    setIsEditing(true);
                  } else {
                    onDayClick?.(key);
                  }
                }}
              >
                {isFirstOfMonth && cellWidth > 60 && (
                  <div className="absolute top-0 left-0 bg-foreground text-background text-[10px] leading-none uppercase tracking-wide px-1.5 py-0.5">
                    {monthShort[date.getMonth()]}
                  </div>
                )}
                <div
                  className={cn(
                    "absolute top-0.5 text-[10px] leading-none text-muted-foreground",
                    cellWidth > 60 ? "right-1 text-right" : "left-1 text-left",
                    isToday && "text-primary font-semibold"
                  )}
                >
                  {showDaysOfWeek && (
                    <span className="text-[10px] opacity-60 mr-0.5">
                      {dayOfWeekShort[date.getDay()]}
                    </span>
                  )}
                  {date.getDate()}
                </div>
                {/* Event chips removed; events are rendered as spanning bars below */}
              </div>
            );
          })}
        </div>
        {/* Absolute overlay using pixel positioning to perfectly align with day cells */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ padding: 1 }}
        >
          {React.useMemo(() => {
            const cols = gridDims.cols || 12;
            const gap = 1; // matches gap-px
            const pad = 0; // already accounted by wrapper padding style above
            if (!cols || !cellSizePx.w || !cellSizePx.h) return null;
            type Seg = {
              row: number;
              startCol: number;
              endCol: number;
              ev: AllDayEvent;
            };
            const rowToSegs = new Map<number, Seg[]>();
            const yearStartKey = formatDateKey(new Date(year, 0, 1));
            const yearEndKey = formatDateKey(new Date(year, 11, 31));
            const totalDaysInYear = days.filter((d) => d !== null).length;
            for (const ev of events) {
              // Clamp event dates to year boundaries to handle cross-year events
              // ev.endDate is exclusive (day after last day of event)
              const clampedStartDate =
                ev.startDate < yearStartKey ? yearStartKey : ev.startDate;
              // If endDate is after the year, clamp to day after Dec 31 (which is Jan 1 of next year)
              // Since we can't look up next year's date, we'll use totalDaysInYear as the exclusive end index
              const clampedEndDate =
                ev.endDate > yearEndKey ? null : ev.endDate;

              // Check if event overlaps with this year at all
              if (clampedStartDate > yearEndKey) continue; // Event starts after this year
              if (clampedEndDate !== null && clampedEndDate <= yearStartKey)
                continue; // Event ends before this year

              const startIdx = dayIndexByKey.get(clampedStartDate);
              if (startIdx == null) continue;

              // For end index: if clampedEndDate is null, event extends past year end
              // Otherwise, look up the exclusive end date
              let endIdxExclusive: number | null;
              if (clampedEndDate === null) {
                // Event extends past Dec 31, so exclusive end is after the last day of the year
                endIdxExclusive = totalDaysInYear;
              } else {
                endIdxExclusive = dayIndexByKey.get(clampedEndDate) ?? null;
              }

              if (endIdxExclusive == null) continue;
              let segStart = startIdx;
              while (segStart < endIdxExclusive) {
                const row = Math.floor(segStart / cols);
                const rowEndExclusive = Math.min(
                  endIdxExclusive,
                  (row + 1) * cols
                );
                const startCol = segStart % cols; // 0-based inclusive
                const endCol =
                  rowEndExclusive % cols === 0 ? cols : rowEndExclusive % cols; // 1..cols inclusive
                const list = rowToSegs.get(row) ?? [];
                list.push({ row, startCol, endCol, ev });
                rowToSegs.set(row, list);
                segStart = rowEndExclusive;
              }
            }
            const bars: Array<React.ReactElement> = [];
            const labelOffset = 20; // Increased from 16 to add more margin above events
            const laneHeight = 16;
            const maxLanes = Math.max(
              1,
              Math.floor((cellSizePx.h - labelOffset - 2) / laneHeight)
            );
            for (const [row, segs] of rowToSegs) {
              segs.sort((a, b) => a.startCol - b.startCol);
              const laneEnds: number[] = [];
              for (const seg of segs) {
                let lane = 0;
                while (
                  lane < laneEnds.length &&
                  seg.startCol < laneEnds[lane]
                ) {
                  lane++;
                }
                if (lane >= maxLanes) continue;
                if (lane === laneEnds.length) laneEnds.push(seg.endCol);
                else laneEnds[lane] = seg.endCol;
                const left = pad + seg.startCol * (cellSizePx.w + gap);
                const top =
                  pad +
                  row * (cellSizePx.h + gap) +
                  labelOffset +
                  lane * laneHeight;
                const span = seg.endCol - seg.startCol;
                const width = span * cellSizePx.w + (span - 1) * gap;
                const key = `${seg.ev.id}:${row}:${seg.startCol}-${seg.endCol}:${lane}`;
                const bg = seg.ev.calendarId
                  ? calendarColors[seg.ev.calendarId]
                  : undefined;
                bars.push(
                  <div
                    key={key}
                    style={{
                      position: "absolute",
                      left,
                      top,
                      width,
                      height: laneHeight - 2,
                    }}
                    className="px-1 pointer-events-auto cursor-pointer"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (
                        e.currentTarget as HTMLDivElement
                      ).getBoundingClientRect();
                      const pos = calculatePopoverPosition(
                        rect.left,
                        rect.top,
                        rect.width,
                        rect.height,
                        e.clientX,
                        e.clientY
                      );
                      setPopover({
                        event: seg.ev,
                        x: pos.x,
                        y: pos.y,
                        position: pos.position,
                      });
                      setIsEditing(true);
                    }}
                  >
                    <div
                      className="truncate rounded-sm px-1 text-[10px] leading-[14px] shadow-sm text-white dark:text-black"
                      style={{
                        backgroundColor: bg || "hsl(var(--secondary))",
                        height: laneHeight - 2,
                        lineHeight: `${laneHeight - 4}px`,
                      }}
                    >
                      {seg.ev.summary}
                    </div>
                  </div>
                );
              }
            }
            return bars;
          }, [
            events,
            dayIndexByKey,
            gridDims.cols,
            cellSizePx,
            calendarColors,
          ])}
        </div>
      </div>
      {((popover.event || popover.creatingDateKey) && isEditing) && (
        <>
          {isMobile && (
            <div
              className="fixed inset-0 bg-background/60 z-40"
                        onClick={() => {
                          if (!isSubmitting) {
                            setIsEditing(false);
                            setPopover({ event: null, x: 0, y: 0 });
                            setMenuOpen(false);
                            setMenuPosition(null);
                          }
                        }}
              aria-hidden
            />
          )}
          <div
            ref={popoverRef}
            className={cn(
              "border border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] bg-[hsl(0,0%,99%)] dark:bg-[hsl(0,0%,10%)] shadow-lg pointer-events-auto z-50",
              isMobile
                ? "fixed bottom-0 left-0 right-0 w-full rounded-t-3xl rounded-b-none max-h-[80vh] overflow-y-auto transition-transform"
                : "fixed rounded-md w-full max-w-md"
            )}
            style={
              isMobile
                ? {
                    transform: `translateY(${Math.max(0, dragOffset)}px)`,
                    transition: isDragging
                      ? "none"
                      : isAnimatingIn
                      ? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                      : "transform 0.3s ease-out",
                  }
                : !isMobile && popover.x !== undefined && popover.y !== undefined
                ? {
                    top: `${popover.y}px`,
                    left: `${popover.x}px`,
                    transform: `${
                      popover.position?.left ? "translateX(-100%)" : "translateX(0)"
                    } ${
                      popover.position?.above ? "translateY(-100%)" : "translateY(0)"
                    }`,
                    maxWidth: "400px",
                  }
                : {}
            }
            role="dialog"
            aria-label={popover.event ? "Edit event" : "Create event"}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              if (!isMobile || isSubmitting) return;
              const touch = e.touches[0];
              const target = e.target as HTMLElement;
              const bottomSheet = popoverRef.current;
              if (!bottomSheet) return;

              // Only allow dragging from the header area (first 60px or so)
              const headerHeight = 60;
              const scrollTop = bottomSheet.scrollTop;

              if (
                scrollTop === 0 &&
                touch.clientY - bottomSheet.getBoundingClientRect().top <
                  headerHeight
              ) {
                setIsDragging(true);
                dragStartY.current = touch.clientY;
                dragStartOffset.current = dragOffset;
                e.preventDefault();
              }
            }}
            onTouchMove={(e) => {
              if (!isMobile || !isDragging || isSubmitting) return;
              const touch = e.touches[0];
              const deltaY = touch.clientY - dragStartY.current;
              const newOffset = Math.max(0, dragStartOffset.current + deltaY);
              setDragOffset(newOffset);
              e.preventDefault();
            }}
            onTouchEnd={(e) => {
              if (!isMobile || !isDragging) return;
              setIsDragging(false);

              // Dismiss if dragged down more than 100px or 20% of viewport height
              const threshold = Math.min(100, window.innerHeight * 0.2);
              if (dragOffset > threshold) {
                setIsEditing(false);
                setPopover({ event: null, x: 0, y: 0 });
                setMenuOpen(false);
                setMenuPosition(null);
                // Reset after a delay to allow the dismiss animation
                setTimeout(() => setDragOffset(0), 300);
              } else {
                // Snap back
                setDragOffset(0);
              }
              e.preventDefault();
            }}
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
                {popover.event ? "Event" : "New Event"}
              </div>
              <div className="flex items-center gap-1">
                {popover.event && !popover.creatingDateKey && (
                  <div className="relative" ref={menuRef}>
                    <button
                      ref={menuButtonRef}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMobile && menuButtonRef.current) {
                          const rect =
                            menuButtonRef.current.getBoundingClientRect();
                          const menuWidth = 192; // w-48 = 192px
                          const padding = 8;
                          let left = rect.right - menuWidth;
                          if (left < padding) {
                            left = padding;
                          }
                          const maxLeft = window.innerWidth - menuWidth - padding;
                          if (left > maxLeft) {
                            left = maxLeft;
                          }
                          setMenuPosition({
                            top: rect.bottom + 4,
                            left,
                          });
                        } else {
                          setMenuPosition(null);
                        }
                        setMenuOpen(!menuOpen);
                      }}
                      aria-label="More options"
                    >
                      <MoreHorizontal
                        className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")}
                      />
                    </button>
                  {menuOpen && (
                    <div
                      className={cn(
                        "w-48 bg-[hsl(0,0%,99%)] dark:bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] rounded-md shadow-lg z-50 py-1",
                        isMobile ? "fixed" : "absolute right-0 top-full mt-1"
                      )}
                      style={
                        isMobile && menuPosition
                          ? {
                              top: `${menuPosition.top}px`,
                              left: `${menuPosition.left}px`,
                              right: "auto",
                            }
                          : undefined
                      }
                    >
                      <button
                        className={cn(
                          "w-full text-left px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition",
                          isMobile ? "text-base" : "text-sm"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onHideEvent && popover.event && !popover.creatingDateKey) {
                            onHideEvent(popover.event.id);
                          }
                          setPopover({ event: null, x: 0, y: 0 });
                          setIsEditing(false);
                          setMenuOpen(false);
                          setMenuPosition(null);
                        }}
                      >
                        Hide event
                      </button>
                      {onDeleteEvent && popover.event && !popover.creatingDateKey && (
                        <button
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground transition",
                            isMobile ? "text-base" : "text-sm"
                          )}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const id = popover.event?.id;
                            if (!id) return;
                            const ok =
                              typeof window !== "undefined"
                                ? window.confirm("Delete this event?")
                                : true;
                            if (!ok) return;
                            try {
                              await onDeleteEvent(id);
                            } finally {
                              setPopover({ event: null, x: 0, y: 0 });
                              setIsEditing(false);
                              setMenuOpen(false);
                              setMenuPosition(null);
                            }
                          }}
                        >
                          Delete event
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                )}
                <button
                  className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1"
                  onClick={() => {
                    setIsEditing(false);
                    setPopover({ event: null, x: 0, y: 0 });
                    setMenuOpen(false);
                    setMenuPosition(null);
                  }}
                  disabled={isSubmitting}
                  aria-label="Close"
                >
                  <X className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                </button>
              </div>
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
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={isSubmitting}
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
                      ref={editStartDateInputRef}
                      type="date"
                      className={cn(
                        "border-0 bg-transparent px-0 py-1 focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
                        isMobile ? "text-base w-28" : "text-sm w-24"
                      )}
                      value={editStartDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditStartDate(v);
                        if (
                          editHasEndDate &&
                          editEndDate &&
                          v &&
                          editEndDate < v
                        ) {
                          setEditEndDate(v);
                        }
                      }}
                      onClick={(e) => {
                        e.currentTarget.showPicker?.();
                        e.currentTarget.focus();
                      }}
                      disabled={isSubmitting}
                    />
                    {editHasEndDate && (
                      <>
                        <span className="text-muted-foreground">–</span>
                        <input
                          ref={editEndDateInputRef}
                          type="date"
                          className={cn(
                            "border-0 bg-transparent px-0 py-1 focus:outline-none focus:ring-0 ml-2 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
                            isMobile ? "text-base w-28" : "text-sm"
                          )}
                          value={editEndDate}
                          min={editStartDate || undefined}
                          onChange={(e) => setEditEndDate(e.target.value)}
                          onClick={(e) => {
                            e.currentTarget.showPicker?.();
                            e.currentTarget.focus();
                          }}
                          disabled={isSubmitting}
                        />
                      </>
                    )}
                  </div>
                  {editHasEndDate ? (
                    <div
                      className={cn(
                        "flex items-center",
                        isMobile ? "gap-1" : ""
                      )}
                    >
                      <button
                        type="button"
                        className={cn(
                          "text-muted-foreground hover:text-foreground flex-shrink-0",
                          isMobile ? "p-1" : "text-xs"
                        )}
                        onClick={() => {
                          setEditHasEndDate(false);
                          setEditEndDate("");
                        }}
                        disabled={isSubmitting}
                        aria-label="Remove end date"
                      >
                        {isMobile ? <Trash2 className="h-5 w-5" /> : "Remove"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={cn(
                        "text-muted-foreground hover:text-foreground",
                        isMobile ? "text-sm" : "text-xs"
                      )}
                      onClick={() => {
                        setEditHasEndDate(true);
                        if (!editEndDate) setEditEndDate(editStartDate);
                      }}
                      disabled={isSubmitting}
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
                  {editCalendarId && calendarColors[editCalendarId] ? (
                    <div
                      className={cn(
                        "rounded-full",
                        isMobile ? "w-5 h-5" : "w-3 h-3"
                      )}
                      style={{
                        backgroundColor: calendarColors[editCalendarId],
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
                    value={editCalendarId}
                    onValueChange={setEditCalendarId}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-full border-0 bg-transparent px-0 py-1 h-auto shadow-none focus:ring-0 justify-start gap-1",
                        isMobile ? "text-base" : "text-sm"
                      )}
                    >
                      <SelectValue placeholder="Select a calendar">
                        {editCalendarId && calendarNames[editCalendarId]
                          ? calendarNames[editCalendarId]
                          : "Select a calendar"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {writableAccountsWithCalendars.length > 0
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
                        : writableCalendars.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {(c.accountEmail ? `${c.accountEmail} — ` : "") +
                                c.summary}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                onClick={() => {
                  setIsEditing(false);
                  setPopover({ event: null, x: 0, y: 0 });
                  setMenuOpen(false);
                  setMenuPosition(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className={cn(isMobile && "flex-1")}
                onClick={async () => {
                  if (!editTitle.trim()) {
                    alert("Title is required");
                    return;
                  }
                  if (!editCalendarId) {
                    alert("Calendar is required");
                    return;
                  }
                  if (
                    editHasEndDate &&
                    editEndDate &&
                    editEndDate < editStartDate
                  ) {
                    alert("End date must be on/after start date");
                    return;
                  }
                  try {
                    setIsSubmitting(true);
                    if (popover.event && onUpdateEvent) {
                      // Editing existing event
                      await onUpdateEvent({
                        id: popover.event.id,
                        title: editTitle.trim(),
                        calendarId: editCalendarId,
                        startDate: editStartDate,
                        endDate: editHasEndDate ? editEndDate : undefined,
                      });
                    } else if (popover.creatingDateKey && onCreateEvent) {
                      // Creating new event
                      await onCreateEvent({
                        title: editTitle.trim(),
                        calendarId: editCalendarId,
                        startDate: editStartDate,
                        endDate: editHasEndDate ? editEndDate : undefined,
                      });
                    }
                    setIsEditing(false);
                    setPopover({ event: null, x: 0, y: 0 });
                    setMenuOpen(false);
                    setMenuPosition(null);
                  } catch (err) {
                    alert(popover.event ? "Failed to update event" : "Failed to create event");
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting || !editTitle.trim()}
              >
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </>
      )}

      {!signedIn && (
        <>
          <div className="fixed inset-0 bg-background/60 z-40" aria-hidden />
          {isMobile ? (
            <div className="fixed bottom-0 left-0 right-0 w-full rounded-t-3xl rounded-b-none border border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] bg-[hsl(0,0%,99%)] dark:bg-[hsl(0,0%,10%)] shadow-lg pointer-events-auto z-50 px-6 py-6 text-center">
              <div className="text-xl font-medium mb-1">Big Year</div>
              <div className="text-base text-muted-foreground mb-4">
                A calendar for all-day events.
              </div>
              <Button
                className="w-full text-base py-6"
                onClick={() => {
                  const callbackUrl =
                    typeof window !== "undefined" ? window.location.href : "/";
                  signIn("google", { callbackUrl });
                }}
              >
                Sign in with Google
              </Button>
              <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                <Link
                  href="/privacy"
                  className="hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </Link>
                <span>•</span>
                <Link
                  href="/terms"
                  className="hover:text-foreground transition-colors"
                >
                  Terms of Service
                </Link>
              </div>
            </div>
          ) : (
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
              <div className="w-[400px] max-w-[80vw] rounded-md border border-[hsl(0,0%,85%)] dark:border-[hsl(0,0%,20%)] bg-[hsl(0,0%,99%)] dark:bg-[hsl(0,0%,10%)] p-5 md:p-12 text-center shadow-sm pointer-events-auto">
                <div className="text-lg font-medium mb-1">Big Year</div>
                <div className="text-sm text-muted-foreground mb-4">
                  A calendar for all-day events.
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    const callbackUrl =
                      typeof window !== "undefined"
                        ? window.location.href
                        : "/";
                    signIn("google", { callbackUrl });
                  }}
                >
                  Sign in with Google
                </Button>
                <div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                  <Link
                    href="/privacy"
                    className="hover:text-foreground transition-colors"
                  >
                    Privacy Policy
                  </Link>
                  <span>•</span>
                  <Link
                    href="/terms"
                    className="hover:text-foreground transition-colors"
                  >
                    Terms of Service
                  </Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
