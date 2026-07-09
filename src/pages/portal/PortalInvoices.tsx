import { useCustomerDocuments, getSignedDocUrl } from '@/hooks/useCustomerDocuments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Receipt, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatET } from "@/utils/dateUtils";

export default function PortalInvoices() {
  const { data: invoices, isLoading } = useCustomerDocuments('invoice');

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
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground">Billing statements and payment records.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !invoices?.length ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No invoices yet.</div>
          ) : (
            <div className="divide-y">
              {invoices.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{d.title}</div>
                      <div className="text-xs text-muted-foreground">{formatET(d.created_at, 'MMM d, yyyy')}</div>
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
