import { supabase } from "@/integrations/supabase/client";

const DEFAULT_BUCKET = "order-pdfs";
const FALLBACK_BUCKETS = ["order-pdfs", "po-attachments"];
const SIGNED_URL_EXPIRY = 3600; // 1 hour
const SUPABASE_STORAGE_OBJECT_PATH = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/;

export interface PdfLocation {
  bucket: string;
  path: string;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Parse a stored pdf_url value into its bucket + path.
 * Handles:
 *  - Full Supabase public/sign URLs (any bucket, e.g. order-pdfs, po-attachments)
 *  - Plain relative paths (assumed to live in the default order-pdfs bucket)
 */
export function parsePdfLocation(pdfUrl: string): PdfLocation {
  const trimmedUrl = pdfUrl.trim();
  const withoutQuery = trimmedUrl.split("?")[0];
  const match = trimmedUrl.match(SUPABASE_STORAGE_OBJECT_PATH);
  if (match) {
    return { bucket: safeDecode(match[1]), path: safeDecode(match[2]) };
  }

  // Legacy fallback for any URL containing a known bucket segment.
  for (const bucket of FALLBACK_BUCKETS) {
    const marker = `/${bucket}/`;
    if (withoutQuery.includes(marker)) {
      const parts = withoutQuery.split(marker);
      return { bucket, path: safeDecode(parts[parts.length - 1]) };
    }
  }

  // Bucket-prefixed path, e.g. order-pdfs/customer/file.pdf
  for (const bucket of FALLBACK_BUCKETS) {
    if (withoutQuery.startsWith(`${bucket}/`)) {
      return { bucket, path: safeDecode(withoutQuery.slice(bucket.length + 1)) };
    }
  }

  // Plain path
  return { bucket: DEFAULT_BUCKET, path: safeDecode(withoutQuery) };
}

function uniqueLocations(primary: PdfLocation): PdfLocation[] {
  const pathVariants = Array.from(new Set([primary.path, safeDecode(primary.path), encodeURI(primary.path)]));
  const locations = pathVariants.map((path) => ({ ...primary, path }));
  for (const bucket of FALLBACK_BUCKETS) {
    for (const path of pathVariants) {
      locations.push({ bucket, path });
    }
  }

  const seen = new Set<string>();
  return locations.filter((location) => {
    const key = `${location.bucket}/${location.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Backwards-compatible: extract just the file path portion of a pdf_url.
 */
export function extractFilePath(pdfUrl: string): string {
  return parsePdfLocation(pdfUrl).path;
}

/**
 * Creates a signed URL for viewing a PDF, using the bucket parsed from the stored value.
 */
export async function getSignedPdfUrl(pdfUrl: string): Promise<string | null> {
  const trimmedUrl = pdfUrl.trim();
  if (!trimmedUrl) return null;

  if (isHttpUrl(trimmedUrl) && !trimmedUrl.includes("/storage/v1/object/") && !trimmedUrl.includes("/order-pdfs/")) {
    return trimmedUrl;
  }

  const parsedLocation = parsePdfLocation(trimmedUrl);

  for (const { bucket, path } of uniqueLocations(parsedLocation)) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_EXPIRY);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }

    if (error) {
      console.warn(`Failed to create signed URL (bucket=${bucket}, path=${path}):`, error.message);
    }
  }

  return null;
}
