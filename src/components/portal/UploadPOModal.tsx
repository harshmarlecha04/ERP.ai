import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ACCEPT = '.pdf,.docx,.xls,.xlsx';
const MAX_BYTES = 20 * 1024 * 1024;

type Stage = 'idle' | 'uploading' | 'scanning' | 'opening';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UploadPOModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFile(null);
    setStage('idle');
    setDragOver(false);
  };

  const handleClose = (next: boolean) => {
    if (stage !== 'idle' && stage !== 'opening') return; // don't allow close mid-upload
    if (!next) reset();
    onOpenChange(next);
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    const ok = ['.pdf', '.docx', '.xls', '.xlsx'].some((ext) => lower.endsWith(ext));
    if (!ok) {
      toast.error('Unsupported file type. Upload a PDF, DOCX, or Excel file.');
      return;
    }
    if (lower.endsWith('.doc')) {
      toast.error('Legacy .doc files aren\'t supported. Please save as DOCX or PDF.');
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error('File exceeds 20 MB limit.');
      return;
    }
    setFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  };

  const submit = async () => {
    if (!file) return;
    try {
      setStage('uploading');
      const fd = new FormData();
      fd.append('file', file);

      setStage('scanning');
      const { data, error } = await supabase.functions.invoke('scan-portal-po', {
        body: fd,
      });
      if (error) throw error;
      if (!data) throw new Error('Empty response from scanner.');

      setStage('opening');

      // Save scan result into order_drafts so the New PO form can hydrate it.
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult.user?.id;
      if (!userId) throw new Error('Not signed in.');

      const payload = {
        kind: 'po_scan',
        scanned_at: new Date().toISOString(),
        pdf_path: data.pdf_path,
        file_name: data.file_name,
        extraction: data.extraction,
      };
      const { error: dErr } = await supabase
        .from('order_drafts')
        .upsert({ user_id: userId, order_data: payload } as any, { onConflict: 'user_id' });
      if (dErr) throw dErr;

      toast.success('PO scanned. Review the details before submitting.');
      onOpenChange(false);
      reset();
      navigate('/portal/purchase-orders/new?from=scan');
    } catch (e: any) {
      console.error(e);
      const msg = e?.context?.error || e?.message || 'Failed to scan PO.';
      toast.error(typeof msg === 'string' ? msg : 'Failed to scan PO.');
      setStage('idle');
    }
  };

  const busy = stage === 'uploading' || stage === 'scanning';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-lg"
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Upload purchase order</DialogTitle>
          <DialogDescription>
            Upload a PDF, Word, or Excel file and we'll auto-fill the New PO form. You'll
            review every field before submitting.
          </DialogDescription>
        </DialogHeader>

        {!file ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={[
              'border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:bg-muted/40',
            ].join(' ')}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <div className="font-medium">Drop your PO here or click to browse</div>
            <div className="text-xs text-muted-foreground mt-2">
              PDF, DOCX, XLS, XLSX · up to 20 MB
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              PDF gives the most accurate results.
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ACCEPT}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <div className="border rounded-md p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{file.name}</div>
              <div className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            {!busy && (
              <Button variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="Remove file">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {stage === 'uploading' ? 'Uploading file…' : 'Scanning with AI — this can take up to a minute…'}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" disabled={busy} onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!file || busy}>
            {busy ? 'Scanning…' : 'Scan & continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
