import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { getRouteMeta } from "@/config/routeMap";

export interface RecentItem {
  path: string;
  label: string;
  visitedAt: number;
}

const STORAGE_KEY = "pharmvista:recent-routes";
const MAX_ITEMS = 8;

const SKIP_PATHS = new Set(["/", "/auth", "/dashboard"]);

function read(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: RecentItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
}

/** Tracks recently visited routes in localStorage. Mount once at app root. */
export function useRecentRouteTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (SKIP_PATHS.has(pathname)) return;
    const meta = getRouteMeta(pathname);
    if (!meta) return;
    const items = read().filter((i) => i.path !== pathname);
    items.unshift({ path: pathname, label: meta.label, visitedAt: Date.now() });
    write(items.slice(0, MAX_ITEMS));
  }, [pathname]);
}

/** Read current list of recent items (snapshot, refresh on open). */
export function useRecentItems(): [RecentItem[], () => void] {
  const [items, setItems] = useState<RecentItem[]>(() => read());
  const refresh = useCallback(() => setItems(read()), []);
  return [items, refresh];
}
