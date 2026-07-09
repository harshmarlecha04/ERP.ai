import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const ROUTES: Record<string, string> = {
  d: '/dashboard',
  o: '/orders',
  p: '/production',
  i: '/raw-materials',
  r: '/reports',
  t: '/tasks',
  f: '/formulas',
};

/** Vim-style `g <key>` navigation shortcuts. */
export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const pending = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (!armed.current && key === 'g') {
        armed.current = true;
        if (pending.current) window.clearTimeout(pending.current);
        pending.current = window.setTimeout(() => { armed.current = false; }, 1200);
        return;
      }
      if (armed.current) {
        armed.current = false;
        if (pending.current) window.clearTimeout(pending.current);
        const route = ROUTES[key];
        if (route) {
          e.preventDefault();
          navigate(route);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate]);
}
