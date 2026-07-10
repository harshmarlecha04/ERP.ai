import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ClipboardList,
  Calendar,
  FileText,
  Users,
  Sparkles,
  Receipt,
  Beaker,
  Plus,
  CheckSquare,
  MessageSquare,
  History,
  ClipboardCheck,
  Building2,
  ScanText,
} from 'lucide-react';
import { useRecentItems } from '@/hooks/useRecentItems';
import { useEntitySearch, EntityHit } from '@/hooks/useEntitySearch';

const NAV = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { label: 'Order Management', path: '/order-management', icon: ClipboardList },
  { label: 'Customer Orders', path: '/orders', icon: ClipboardList },
  { label: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingCart },
  { label: 'Inventory', path: '/inventory', icon: Package },
  { label: 'Material Requirements', path: '/material-requirements', icon: ClipboardList },
  { label: 'Production Schedule', path: '/production', icon: Calendar },
  { label: 'Packaging', path: '/packaging', icon: Package },
  { label: 'Formulas', path: '/formula', icon: FileText },
  { label: 'Quality & Yield', path: '/quality', icon: Sparkles },
  { label: 'Customers', path: '/customers', icon: Users },
  { label: 'Vendors', path: '/supplier', icon: Users },
  { label: 'Customer Invoicing', path: '/invoicing', icon: Receipt },
  { label: 'R&D Projects', path: '/rd-projects', icon: Beaker },
  { label: 'Communications', path: '/communications', icon: MessageSquare },
  { label: 'AI Assistant', path: '/assistant', icon: Sparkles },
  { label: 'Label Review', path: '/agents/label-review', icon: ScanText },
];

const ACTIONS = [
  { label: 'Create Task', path: '/tasks?new=1', icon: Plus },
  { label: 'New Purchase Order', path: '/purchase-orders?new=1', icon: Plus },
  { label: 'New Customer Order', path: '/orders?new=1', icon: Plus },
  { label: 'New Formula', path: '/formula?new=1', icon: Plus },
];

const ENTITY_ICONS: Record<EntityHit['kind'], React.ComponentType<{ className?: string }>> = {
  order: ClipboardCheck,
  po: ShoppingCart,
  formula: FileText,
  customer: Building2,
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const [recent, refreshRecent] = useRecentItems();
  const { results: entityResults, loading: entityLoading } = useEntitySearch(query);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) refreshRecent();
    else setQuery('');
  }, [open, refreshRecent]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const isSearching = query.trim().length >= 2;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search pages, jump to an order/PO/formula/customer, run actions..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {entityLoading ? 'Searching…' : 'No results found.'}
        </CommandEmpty>

        {isSearching && entityResults.length > 0 && (
          <>
            <CommandGroup heading="Jump to">
              {entityResults.map((hit) => {
                const Icon = ENTITY_ICONS[hit.kind];
                return (
                  <CommandItem
                    key={`${hit.kind}-${hit.id}`}
                    value={`jump-${hit.kind}-${hit.id}-${hit.label}`}
                    onSelect={() => go(hit.path)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{hit.label}</span>
                    {hit.subtitle && (
                      <span className="ml-2 text-xs text-muted-foreground">{hit.subtitle}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {!isSearching && recent.length > 0 && (
          <>
            <CommandGroup heading="Recently viewed">
              {recent.map((r) => (
                <CommandItem key={`recent-${r.path}`} onSelect={() => go(r.path)}>
                  <History className="mr-2 h-4 w-4" />
                  {r.label}
                  <span className="ml-2 text-xs text-muted-foreground">{r.path}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Quick actions">
          {ACTIONS.map((a) => (
            <CommandItem key={a.path} onSelect={() => go(a.path)}>
              <a.icon className="mr-2 h-4 w-4" />
              {a.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          {NAV.map((n) => (
            <CommandItem key={n.path} onSelect={() => go(n.path)}>
              <n.icon className="mr-2 h-4 w-4" />
              {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
