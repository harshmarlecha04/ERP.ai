import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CHANGELOG, LATEST_CHANGELOG_DATE } from "@/lib/changelog";
import { format } from "date-fns";
import { formatET } from "@/utils/dateUtils";

const STORAGE_KEY = "pharmvista:changelog-last-seen";

function renderMarkdown(md: string) {
  // Lightweight renderer: bullets + paragraphs + bold/italic + inline code
  const lines = md.split("\n");
  const out: JSX.Element[] = [];
  let listBuf: string[] = [];
  const flushList = (key: string) => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1 my-2">
          {listBuf.map((l, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(l.replace(/^\s*[-*]\s+/, "")) }} />
          ))}
        </ul>
      );
      listBuf = [];
    }
  };
  const inline = (s: string) =>
    s
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-xs">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  lines.forEach((line, i) => {
    if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line);
    } else if (line.trim() === "") {
      flushList(String(i));
    } else {
      flushList(String(i));
      out.push(<p key={`p-${i}`} className="text-sm my-1" dangerouslySetInnerHTML={{ __html: inline(line) }} />);
    }
  });
  flushList("end");
  return out;
}

export function ChangelogDrawer() {
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? "");

  const hasUnread = LATEST_CHANGELOG_DATE && LATEST_CHANGELOG_DATE > lastSeen;

  useEffect(() => {
    if (open && LATEST_CHANGELOG_DATE) {
      localStorage.setItem(STORAGE_KEY, LATEST_CHANGELOG_DATE);
      setLastSeen(LATEST_CHANGELOG_DATE);
    }
  }, [open]);

  if (CHANGELOG.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label="What's new"
        >
          <Megaphone className="h-4 w-4" />
          {hasUnread && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>What's new</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-6rem)] mt-4 pr-4">
          <div className="space-y-6">
            {CHANGELOG.map((entry) => (
              <article key={entry.id} className="border-b pb-4 last:border-b-0">
                <header className="mb-2">
                  <h3 className="text-base font-semibold">{entry.title}</h3>
                  {entry.date && (
                    <time className="text-xs text-muted-foreground">
                      {formatET(entry.date, "MMMM d, yyyy")}
                    </time>
                  )}
                </header>
                <div className="text-sm">{renderMarkdown(entry.body)}</div>
              </article>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
