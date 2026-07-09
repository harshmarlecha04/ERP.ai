import { ShoppingCart, Package, Boxes, Factory, ClipboardList, CheckCircle, FlaskConical, Paperclip, FileCheck, LucideIcon } from "lucide-react";

export interface DashboardShortcutConfig {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  color: string;
}

export const DEFAULT_SHORTCUTS: DashboardShortcutConfig[] = [
  { key: "purchase-orders", label: "RM Orders", path: "/purchase-orders", icon: ShoppingCart, color: "bg-amber-500" },
  { key: "inventory", label: "Inventory", path: "/inventory", icon: Package, color: "bg-blue-500" },
  { key: "packaging", label: "Packaging", path: "/packaging", icon: Boxes, color: "bg-cyan-500" },
  { key: "production", label: "Production", path: "/production", icon: Factory, color: "bg-orange-500" },
  { key: "orders", label: "FP Orders", path: "/orders", icon: ClipboardList, color: "bg-purple-500" },
  { key: "quality", label: "Quality", path: "/quality", icon: CheckCircle, color: "bg-green-500" },
  { key: "formula", label: "Formula", path: "/formula", icon: FlaskConical, color: "bg-teal-500" },
  { key: "office-supplies", label: "Office Supplies", path: "/office-supplies", icon: Paperclip, color: "bg-pink-500" },
  { key: "ez-label", label: "EZ Label", path: "/agents/label-review", icon: FileCheck, color: "bg-indigo-500" },
];

export function getShortcutConfig(key: string): DashboardShortcutConfig | undefined {
  return DEFAULT_SHORTCUTS.find(s => s.key === key);
}
