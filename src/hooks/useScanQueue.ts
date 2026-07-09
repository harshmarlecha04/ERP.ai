import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QueuedScan {
  id: string;
  raw_material_id: string;
  raw_material_name: string;
  raw_material_code: string;
  lot_number: string;
  quantity: number;
  cost: number;
  expires_on: string | null;
  open_po_id: string | null;
  scanned_at: number;
  status: "pending" | "syncing" | "synced" | "error";
  error?: string;
}

const KEY = "receive_scan_queue_v1";
const HISTORY_KEY = "receive_scan_history_v1";

function read(key: string): QueuedScan[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
function write(key: string, val: QueuedScan[]) {
  localStorage.setItem(key, JSON.stringify(val.slice(0, 200)));
}

export function useScanQueue() {
  const [queue, setQueue] = useState<QueuedScan[]>(() => read(KEY));
  const [history, setHistory] = useState<QueuedScan[]>(() => read(HISTORY_KEY));
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const persist = useCallback((next: QueuedScan[]) => {
    setQueue(next);
    write(KEY, next);
  }, []);

  const addToHistory = useCallback((scan: QueuedScan) => {
    setHistory((h) => {
      const next = [scan, ...h].slice(0, 100);
      write(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const enqueue = useCallback(
    (scan: Omit<QueuedScan, "id" | "scanned_at" | "status">) => {
      const item: QueuedScan = {
        ...scan,
        id: crypto.randomUUID(),
        scanned_at: Date.now(),
        status: "pending",
      };
      persist([item, ...queue]);
      return item;
    },
    [queue, persist],
  );

  const remove = useCallback(
    (id: string) => persist(queue.filter((q) => q.id !== id)),
    [queue, persist],
  );

  const syncOne = async (item: QueuedScan): Promise<QueuedScan> => {
    const { data: lot, error: lotErr } = await supabase
      .from("raw_material_lots")
      .insert({
        raw_material_id: item.raw_material_id,
        lot_number: item.lot_number,
        quantity: item.quantity,
        cost: item.cost,
        receiving_date: new Date(item.scanned_at).toISOString().split("T")[0],
        expires_on: item.expires_on,
      })
      .select("id")
      .single();
    if (lotErr || !lot) {
      return { ...item, status: "error", error: lotErr?.message || "Insert failed" };
    }
    if (item.open_po_id) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("purchase_orders")
        .update({
          status: "received",
          received_date: new Date(item.scanned_at).toISOString().split("T")[0],
          received_by: user?.id ?? null,
        })
        .eq("id", item.open_po_id);
    }
    return { ...item, status: "synced" };
  };

  const syncAll = useCallback(async () => {
    if (syncing || !online) return;
    setSyncing(true);
    let working = [...queue];
    for (const item of queue.filter((q) => q.status !== "synced")) {
      working = working.map((q) => (q.id === item.id ? { ...q, status: "syncing" } : q));
      persist(working);
      const result = await syncOne(item);
      if (result.status === "synced") {
        addToHistory(result);
        working = working.filter((q) => q.id !== item.id);
      } else {
        working = working.map((q) => (q.id === item.id ? result : q));
      }
      persist(working);
    }
    setSyncing(false);
  }, [queue, online, syncing, persist, addToHistory]);

  // Auto-sync when back online
  useEffect(() => {
    if (online && queue.some((q) => q.status === "pending" || q.status === "error")) {
      syncAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  return { queue, history, online, syncing, enqueue, remove, syncAll };
}
