import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Download, Search, FileImage, Receipt, FlaskConical, ScanText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatET } from "@/utils/dateUtils";

interface DocFile {
  bucket: string;
  path: string;
  name: string;
  size?: number;
  updatedAt?: string;
}

const SOURCES: { key: string; label: string; bucket: string; icon: typeof FileText }[] = [
  { key: "coa", label: "COAs", bucket: "coa-pdfs", icon: FlaskConical },
  { key: "orders", label: "Orders", bucket: "order-pdfs", icon: Receipt },
  { key: "po", label: "POs", bucket: "po-attachments", icon: FileText },
  { key: "labels", label: "Label Reviews", bucket: "label-reviews", icon: ScanText },
];

async function listBucketRecursive(bucket: string, prefix = "", depth = 0): Promise<DocFile[]> {
  if (depth > 3) return [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 200,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error || !data) return [];
  const files: DocFile[] = [];
  for (const item of data) {
    // Folders have null `id`
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      files.push({
        bucket,
        path: fullPath,
        name: item.name,
        size: (item.metadata as any)?.size,
        updatedAt: (item as any).updated_at,
      });
    } else {
      const nested = await listBucketRecursive(bucket, fullPath, depth + 1);
      files.push(...nested);
    }
  }
  return files;
}

function formatBytes(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocList({ files, loading, query }: { files: DocFile[]; loading: boolean; query: string }) {
  const { toast } = useToast();
  const filtered = query
    ? files.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()) || f.path.toLowerCase().includes(query.toLowerCase()))
    : files;

  const open = async (f: DocFile) => {
    const { data, error } = await supabase.storage.from(f.bucket).createSignedUrl(f.path, 3600);
    if (error || !data?.signedUrl) {
      toast({ variant: "destructive", title: "Couldn't open document", description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={FileImage}
        title={query ? "No matching documents" : "No documents yet"}
        description={query ? "Try a different search term." : "Documents will appear here as they are uploaded."}
      />
    );
  }

  return (
    <div className="rounded-md border divide-y">
      {filtered.map((f) => (
        <div key={`${f.bucket}/${f.path}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{f.name}</div>
            <div className="text-xs text-muted-foreground truncate">{f.path}</div>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">{formatBytes(f.size)}</Badge>
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            {f.updatedAt ? formatET(f.updatedAt, "MMM d, yyyy") : ""}
          </span>
          <Button size="sm" variant="ghost" onClick={() => open(f)} aria-label={`Open ${f.name}`}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function Documents() {
  const [tab, setTab] = useState<string>(SOURCES[0].key);
  const [query, setQuery] = useState("");
  const [byBucket, setByBucket] = useState<Record<string, DocFile[]>>({});
  const [loadingBucket, setLoadingBucket] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const source = SOURCES.find((s) => s.key === tab);
    if (!source) return;
    if (byBucket[source.bucket]) return;
    setLoadingBucket((p) => ({ ...p, [source.bucket]: true }));
    listBucketRecursive(source.bucket).then((files) => {
      setByBucket((p) => ({ ...p, [source.bucket]: files }));
      setLoadingBucket((p) => ({ ...p, [source.bucket]: false }));
    });
  }, [tab, byBucket]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Document Hub</h1>
        <p className="text-sm text-muted-foreground">
          Browse COAs, order PDFs, PO attachments and label review reports in one place.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">All documents</CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents…"
                className="pl-8 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              {SOURCES.map((s) => {
                const Icon = s.icon;
                return (
                  <TabsTrigger key={s.key} value={s.key} className="gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {s.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {SOURCES.map((s) => (
              <TabsContent key={s.key} value={s.key} className="mt-4">
                <DocList
                  files={byBucket[s.bucket] ?? []}
                  loading={!!loadingBucket[s.bucket]}
                  query={query}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
