import { Link, useLocation } from "react-router-dom";
import { ScanLine } from "lucide-react";

/**
 * Floating action button that jumps to the barcode scanner.
 * Only shown on mobile (sm:hidden) and on pages where it's most useful.
 */
const SHOW_ON = ["/inventory", "/purchase-orders", "/material-requirements", "/dashboard"];

export function ScanFab() {
  const { pathname } = useLocation();
  if (pathname === "/receive") return null;
  if (!SHOW_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  return (
    <Link
      to="/receive"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/20 transition-transform active:scale-95 sm:hidden"
      aria-label="Open barcode scanner"
    >
      <ScanLine className="h-6 w-6" />
    </Link>
  );
}
