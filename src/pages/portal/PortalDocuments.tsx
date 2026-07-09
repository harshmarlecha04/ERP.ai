import { useState } from 'react';
import { useCustomerDocuments, getSignedDocUrl } from '@/hooks/useCustomerDocuments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatET } from "@/utils/dateUtils";

const KIND_LABEL: Record<string, string> = {
  all: 'All',
  coa: 'COAs',
  formula_pdf: 'Formulas',
  agreement: 'Agreements',
  other: 'Other',
};

export default function PortalDocuments() {
  const [kind, setKind] = useState<string>('all');
  const { data: docs, isLoading } = useCustomerDocuments(kind === 'all' ? undefined : kind);

  const handleDownload = async (path: string, title: string) => {
    try {
      const url = await getSignedDocUrl(path);
      const a = document.createElement('a');
      a.href = url; a.download = title; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) {
      toast.error(e.message || 'Could not generate download link');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground">Certificates of analysis, formulas, and shared files.</p>
      </div>

      <Tabs value={kind} onValueChange={setKind}>
        <TabsList>
          {Object.entries(KIND_LABEL).filter(([k]) => k !== 'invoice').map(([k, l]) => (
            <TabsTrigger key={k} value={k}>{l}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader><CardTitle>Files</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !docs?.length ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No documents yet.</div>
          ) : (
            <div className="divide-y">
              {docs.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{d.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {KIND_LABEL[d.kind] || d.kind} · {formatET(d.created_at, 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(d.storage_path, d.title)}>
                    <Download className="h-4 w-4 mr-1" />Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
