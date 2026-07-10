import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Search, Command, Megaphone, FileText, Sparkles } from 'lucide-react';

interface Step {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

interface Props {
  storageKey: string;
  version?: string;
  steps: Step[];
}

/**
 * Lightweight, dependency-free onboarding modal walkthrough.
 * Shows once per user (gated by localStorage[storageKey] = version).
 */
export function OnboardingTour({ storageKey, version = '1', steps }: Props) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey);
      if (seen !== version) {
        // Delay slightly so the page renders behind it first.
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [storageKey, version]);

  const finish = () => {
    try { localStorage.setItem(storageKey, version); } catch {}
    setOpen(false);
    setI(0);
  };

  if (!steps.length) return null;
  const step = steps[i];
  const Icon = step.icon;
  const last = i === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : finish())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{step.title}</DialogTitle>
          <DialogDescription className="text-center">{step.body}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-1.5 py-2">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 w-6 rounded-full transition-colors ${idx === i ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="ghost" onClick={finish}>Skip</Button>
          <div className="flex gap-2">
            {i > 0 && <Button variant="outline" onClick={() => setI(i - 1)}>Back</Button>}
            <Button onClick={() => (last ? finish() : setI(i + 1))}>
              {last ? 'Get started' : 'Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const EMPLOYEE_TOUR_STEPS: Step[] = [
  { icon: Sparkles, title: 'Welcome to ERP.ai', body: 'A quick 4-step tour of what is new.' },
  { icon: Command, title: 'Press ⌘K anytime', body: 'Open the command palette to jump to any order, formula, PO, or page instantly.' },
  { icon: FileText, title: 'Documents & Reports', body: 'A unified Document Hub and natural-language Reports are now in the sidebar.' },
  { icon: Megaphone, title: 'What\'s New', body: 'Click the megaphone in the header to see the changelog whenever a dot appears.' },
];

export const PORTAL_TOUR_STEPS: Step[] = [
  { icon: Sparkles, title: 'Welcome to your portal', body: 'Track orders, message our team, and submit POs in one place.' },
  { icon: FileText, title: 'Live order timeline', body: 'Open any order to see its real-time progress across our 6-stage pipeline.' },
  { icon: Search, title: 'Quick search', body: 'Use the search at the top to find any order or document by number.' },
];
