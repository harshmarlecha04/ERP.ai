// Shared Anthropic (Claude) client for Supabase Edge Functions.
//
// This is the single AI provider client. All AI edge functions import
// from here so there is exactly ONE place that talks to the model provider.
//
// Required secret (set with `supabase secrets set`):
//   ANTHROPIC_API_KEY = sk-ant-...
//
// Docs: https://docs.claude.com/en/api/messages

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Central model map. Change a model in ONE place here and every function
// that uses that role picks it up. Model strings are pinned snapshots.
export const MODELS = {
  // General text reasoning (assistant, reports, insights summaries)
  default: "claude-sonnet-4-6",
  // Heavy document / vision extraction (COA + PO scanning)
  vision: "claude-opus-4-7",
} as const;

export function getApiKey(): string {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  return key;
}

// --- Types ---------------------------------------------------------------

export interface AnthropicTextBlock {
  type: "text";
  text: string;
}

// An Anthropic content block can be text, an image, or a PDF document.
export type AnthropicContentBlock =
  | AnthropicTextBlock
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    }
  | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
    };

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

// Anthropic tool definition (note: flat shape, not nested under `function`)
export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

interface CallOptions {
  model: string;
  system?: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  tools?: AnthropicTool[];
  // When set, forces the model to call this specific tool.
  forceTool?: string;
  stream?: boolean;
}

// --- Helpers -------------------------------------------------------------

// Convert an OpenAI-style chat `messages` array (with a leading system message
// and string/array content) into Anthropic's { system, messages } shape.
// This lets the call sites keep most of their existing message-building code.
export function splitSystem(
  messages: Array<{ role: string; content: any }>,
): { system: string; messages: AnthropicMessage[] } {
  let system = "";
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      system += (system ? "\n\n" : "") + String(m.content ?? "");
      continue;
    }
    if (m.role !== "user" && m.role !== "assistant") continue;
    out.push({ role: m.role, content: m.content });
  }
  return { system, messages: out };
}

// Convert an OpenAI-style tool definition
//   { type:"function", function:{ name, description, parameters } }
// into Anthropic's
//   { name, description, input_schema }
export function toAnthropicTool(openAiTool: any): AnthropicTool {
  const fn = openAiTool?.function ?? openAiTool;
  return {
    name: fn.name,
    description: fn.description,
    input_schema: fn.parameters ?? fn.input_schema ?? { type: "object" },
  };
}

// Map a data URL or mime type to the right Anthropic content block for a file.
export function fileToContentBlock(
  base64: string,
  mimeType: string,
): AnthropicContentBlock {
  if (mimeType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
  }
  return {
    type: "image",
    source: { type: "base64", media_type: mimeType, data: base64 },
  };
}

// --- Core call -----------------------------------------------------------

// Non-streaming call. Returns the parsed Anthropic response JSON.
export async function callAnthropic(opts: CallOptions): Promise<any> {
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    messages: opts.messages,
  };
  if (opts.system) body.system = opts.system;
  if (opts.tools && opts.tools.length) {
    body.tools = opts.tools;
    if (opts.forceTool) {
      body.tool_choice = { type: "tool", name: opts.forceTool };
    }
  }

  const resp = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": getApiKey(),
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    // Preserve status code in the message so callers can map 429/etc.
    throw new Error(`Anthropic ${resp.status}: ${text.slice(0, 500)}`);
  }

  return await resp.json();
}

// Streaming call. Returns the raw Response so the caller can pipe/transform it.
export async function callAnthropicStream(opts: CallOptions): Promise<Response> {
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    messages: opts.messages,
    stream: true,
  };
  if (opts.system) body.system = opts.system;

  return await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": getApiKey(),
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// Pull the plain text out of a non-streaming Anthropic response.
export function extractText(anthropicJson: any): string {
  const blocks = anthropicJson?.content ?? [];
  return blocks
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
}

// Pull the input object of the first tool_use block out of a response.
// This is the Anthropic equivalent of OpenAI's
//   choices[0].message.tool_calls[0].function.arguments
export function extractToolInput(anthropicJson: any): any | null {
  const blocks = anthropicJson?.content ?? [];
  const toolBlock = blocks.find((b: any) => b.type === "tool_use");
  return toolBlock ? toolBlock.input : null;
}

// Transform Anthropic's SSE stream into the OpenAI-style
//   data: {"choices":[{"delta":{"content":"..."}}]}
// ... data: [DONE]
// format, so existing frontend stream parsers keep working unchanged.
export function anthropicStreamToOpenAI(
  upstream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data:")) continue;

            const payload = line.slice(5).trim();
            if (!payload) continue;

            try {
              const evt = JSON.parse(payload);
              // Anthropic emits incremental text on content_block_delta
              if (
                evt.type === "content_block_delta" &&
                evt.delta?.type === "text_delta" &&
                evt.delta.text
              ) {
                const chunk = {
                  choices: [{ delta: { content: evt.delta.text } }],
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
                );
              } else if (evt.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // ignore keep-alives / non-JSON lines
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}
