import { supabase } from '@/integrations/supabase/client';

/**
 * Parse @mentions from text and create mention records (which trigger notifications via DB).
 * Mention syntax: @[Display Name](user-uuid)  OR  bare @username (best-effort match by display_name)
 */
export interface ParsedMention {
  userId: string;
  displayName: string;
}

const STRUCTURED_RE = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;

export function extractMentionsFromText(text: string): ParsedMention[] {
  const out: ParsedMention[] = [];
  let m: RegExpExecArray | null;
  while ((m = STRUCTURED_RE.exec(text))) {
    out.push({ displayName: m[1], userId: m[2] });
  }
  return out;
}

export async function recordMentions(opts: {
  text: string;
  sourceType: string;
  sourceId: string;
  link?: string;
  context?: string;
}): Promise<number> {
  const mentions = extractMentionsFromText(opts.text);
  if (mentions.length === 0) return 0;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const rows = mentions.map((m) => ({
    mentioned_user_id: m.userId,
    mentioned_by: user.id,
    source_type: opts.sourceType,
    source_id: opts.sourceId,
    context: opts.context ?? opts.text.slice(0, 280),
    link: opts.link ?? null,
  }));

  const { error } = await supabase.from('mentions').insert(rows);
  if (error) throw error;
  return rows.length;
}

/** Render mention markup as readable HTML (safe — names only, no raw HTML in source) */
export function renderMentionsAsText(text: string): string {
  return text.replace(STRUCTURED_RE, (_full, name) => `@${name}`);
}
