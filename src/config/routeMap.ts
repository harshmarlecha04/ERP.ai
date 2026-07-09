// Central route → label/parent map used by Breadcrumbs and CommandPalette.
// Keep labels in sync with sidebar entries.

export interface RouteMeta {
  label: string;
  parent?: string; // path of parent route
  hideBreadcrumb?: boolean;
}

export const ROUTE_MAP: Record<string, RouteMeta> = {
  "/dashboard": { label: "Dashboard", hideBreadcrumb: true },
  "/tasks": { label: "Tasks" },
  "/mvp-v1": { label: "Order Management" },

  "/material-requirements": { label: "Material Requirements" },
  "/inventory": { label: "Inventory" },
  "/archived-materials": { label: "Archived Materials", parent: "/inventory" },
  "/packaging": { label: "Packaging" },
  "/shipping": { label: "Shipping", parent: "/packaging" },

  "/purchase-orders": { label: "Purchase Orders" },
  "/supplier": { label: "Vendors" },

  "/production": { label: "Production Schedule" },
  "/formula": { label: "Formulas" },

  "/quality": { label: "Quality & Yield" },

  "/invoicing": { label: "Customer Invoicing" },
  "/customers": { label: "Customers" },
  "/orders": { label: "Customer Orders" },

  "/office-supplies": { label: "Office Supplies" },

  "/agents/label-review": { label: "Label Review", parent: "/dashboard" },

  "/rd-projects": { label: "R&D" },
  "/communications": { label: "Communications" },
  "/inquiries": { label: "Inquiries" },
  "/forecasting": { label: "Forecasting" },
  "/maintenance": { label: "Maintenance" },
  "/users": { label: "Users" },
  "/activity-tracker": { label: "Activity Tracker" },
  "/production-costs": { label: "Production Costs" },
  "/profitability": { label: "Profitability" },
  "/quoting": { label: "Quoting" },
  "/assistant": { label: "Assistant" },
  "/projects": { label: "Projects" },
  "/profile": { label: "Profile" },

  "/documents": { label: "Document Hub" },
  "/reports": { label: "Reports" },
  "/saved-views": { label: "Saved Views" },
  "/changelog": { label: "Changelog" },
  "/onboarding": { label: "Onboarding Tour" },
};

// Dynamic patterns (param-based)
const DYNAMIC_PATTERNS: Array<{ test: RegExp; build: (m: RegExpMatchArray) => RouteMeta }> = [
  { test: /^\/customers\/([^/]+)$/, build: () => ({ label: "Customer Detail", parent: "/customers" }) },
  { test: /^\/orders\/([^/]+)\/approve$/, build: () => ({ label: "Approve Order", parent: "/orders" }) },
  { test: /^\/orders\/([^/]+)$/, build: () => ({ label: "Order Detail", parent: "/orders" }) },
  { test: /^\/formula\/view\/([^/]+)$/, build: () => ({ label: "Formula View", parent: "/formula" }) },
];

export function getRouteMeta(path: string): RouteMeta | undefined {
  if (ROUTE_MAP[path]) return ROUTE_MAP[path];
  for (const p of DYNAMIC_PATTERNS) {
    const m = path.match(p.test);
    if (m) return p.build(m);
  }
  return undefined;
}

export function buildBreadcrumbTrail(path: string): { path: string; label: string }[] {
  const trail: { path: string; label: string }[] = [];
  let current: string | undefined = path;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const meta = getRouteMeta(current);
    if (!meta) break;
    trail.unshift({ path: current, label: meta.label });
    current = meta.parent;
  }
  return trail;
}
