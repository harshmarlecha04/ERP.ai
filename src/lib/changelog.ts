// Loads changelog entries from markdown files at build time using Vite's import.meta.glob.
// Each file should start with a YAML frontmatter block:
//   ---
//   date: 2026-05-24
//   title: My update
//   ---
//   markdown body...

export interface ChangelogEntry {
  id: string;
  date: string; // ISO date
  title: string;
  body: string; // markdown body (after frontmatter)
}

const modules = import.meta.glob("/src/content/changelog/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function parse(raw: string): { date: string; title: string; body: string } {
  const fm = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!fm) return { date: "", title: "Untitled", body: raw };
  const head: Record<string, string> = {};
  fm[1].split("\n").forEach((line) => {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) head[m[1].trim()] = m[2].trim();
  });
  return { date: head.date || "", title: head.title || "Untitled", body: (fm[2] || "").trim() };
}

export const CHANGELOG: ChangelogEntry[] = Object.entries(modules)
  .map(([path, raw]) => {
    const id = path.split("/").pop()!.replace(/\.md$/, "");
    const parsed = parse(raw);
    return { id, ...parsed };
  })
  .sort((a, b) => (a.date < b.date ? 1 : -1));

export const LATEST_CHANGELOG_DATE = CHANGELOG[0]?.date ?? "";
