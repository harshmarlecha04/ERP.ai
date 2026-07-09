import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { buildBreadcrumbTrail, getRouteMeta } from "@/config/routeMap";

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const meta = getRouteMeta(pathname);

  // Hide on dashboard, auth, and unmapped routes
  if (!meta || meta.hideBreadcrumb) return null;

  const trail = buildBreadcrumbTrail(pathname);
  if (trail.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 px-6 py-2 text-xs text-muted-foreground border-b bg-background/50 shrink-0"
    >
      <Link
        to="/dashboard"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        aria-label="Dashboard"
      >
        <Home className="h-3 w-3" />
      </Link>
      {trail.map((crumb, i) => {
        const isLast = i === trail.length - 1;
        return (
          <span key={crumb.path} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 opacity-50" />
            {isLast ? (
              <span className="font-medium text-foreground" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link to={crumb.path} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
