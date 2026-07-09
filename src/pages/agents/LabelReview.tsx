import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, FileText, Loader2, Download, Trash2, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatET } from "@/utils/dateUtils";


interface LabelReview {
  id: string;
  label_file_name: string;
  label_file_path: string;
  report_file_path: string | null;
  summary: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

export default function LabelReview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stage, setStage] = useState<"idle" | "uploading" | "analyzing">("idle");
  const [history, setHistory] = useState<LabelReview[]>([]);

  const [mode, setMode] = useState<"thorough" | "fast">("thorough");
  const [gummyWeight, setGummyWeight] = useState<2.5 | 3 | 3.5 | 4 | null>(null);
  const defaultReviewer = useMemo(
    () => (user?.user_metadata?.full_name as string) || (user?.user_metadata?.display_name as string) || user?.email || "",
    [user]
  );
  const [reviewerName, setReviewerName] = useState<string>("");
  useEffect(() => {
    if (defaultReviewer && !reviewerName) setReviewerName(defaultReviewer);
  }, [defaultReviewer]);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (stage === "analyzing") {
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

  const loadHistory = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("label_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) setHistory(data as LabelReview[]);
  };

  useEffect(() => {
    loadHistory();
  }, [user?.id]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast({ variant: "destructive", title: "PDF only", description: "Please upload a PDF file." });
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Max 20MB." });
      return;
    }
    setFile(f);
  };


  const handleReview = async () => {
    if (!file || !user?.id || gummyWeight === null || !reviewerName.trim()) return;
    try {
      setStage("uploading");
      const path = `${user.id}/labels/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("label-reviews")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      setStage("analyzing");
      const { data, error } = await supabase.functions.invoke("claude-label-review", {
        body: {
          label_path: path,
          label_file_name: file.name,
          mode,
          gummy_weight_g: gummyWeight,
          reviewer_name: reviewerName.trim(),
        },
      });
      if (data?.error) throw new Error(data.error);
      if (error) throw error;

      toast({ title: "Review complete", description: "Your label review report is ready." });
      loadHistory();

    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Review failed",
        description: err?.message ?? "Unknown error",
      });
    } finally {
      setStage("idle");
    }
  };

  const downloadReport = async (path: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("label-reviews").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast({ variant: "destructive", title: "Download failed", description: error?.message });
      return;
    }
    const ext = path.toLowerCase().endsWith(".docx") ? "docx" : "md";
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = `${fileName.replace(/\.pdf$/i, "")}-review.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const viewPastReview = async (row: LabelReview) => {
    if (!row.report_file_path) {
      toast({ variant: "destructive", title: "No report", description: "This review has no report file." });
      return;
    }
    const { data, error } = await supabase.storage
      .from("label-reviews")
      .createSignedUrl(row.report_file_path, 3600);
    if (error || !data?.signedUrl) {
      toast({ variant: "destructive", title: "Open failed", description: error?.message });
      return;
    }
    const isDocx = row.report_file_path.toLowerCase().endsWith(".docx");
    const url = isDocx
      ? `https://docs.google.com/viewer?url=${encodeURIComponent(data.signedUrl)}&embedded=false`
      : data.signedUrl;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    const { error } = await supabase.from("label_reviews").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Delete failed", description: error.message });
      return;
    }
    loadHistory();
  };


  const busy = stage !== "idle";

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Label Review</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a product label PDF and the Label Review agent will analyze it and return a
          downloadable report.
        </p>
      </div>

      {/* Upload card */}
      <Card className="p-6">
        {/* Mode toggle */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground mr-1">Mode:</span>
          <Button
            type="button"
            size="sm"
            variant={mode === "thorough" ? "default" : "outline"}
            onClick={() => setMode("thorough")}
            disabled={busy}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Thorough
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "fast" ? "default" : "outline"}
            onClick={() => setMode("fast")}
            disabled={busy}
          >
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Fast
          </Button>
          <span className="text-xs text-muted-foreground ml-2">
            {mode === "thorough" ? "Sonnet 4.5 · ~45–90s" : "Haiku 4.5 · ~15–25s"}
          </span>
        </div>
        {/* Gummy weight selector */}
        <div className="flex items-center flex-wrap gap-2 mb-4">
          <span className="text-xs text-muted-foreground mr-1">
            Gummy weight: <span className="text-destructive">*</span>
          </span>
          {([2.5, 3, 3.5, 4] as const).map((w) => (
            <Button
              key={w}
              type="button"
              size="sm"
              variant={gummyWeight === w ? "default" : "outline"}
              onClick={() => setGummyWeight(w)}
              disabled={busy}
            >
              {w} g
            </Button>
          ))}
          {gummyWeight === null && (
            <span className="text-xs text-muted-foreground ml-2">Select an average piece weight</span>
          )}
        </div>


        {/* Reviewer name */}
        <div className="flex items-center gap-2 mb-4 max-w-md">
          <Label htmlFor="reviewer-name" className="text-xs text-muted-foreground whitespace-nowrap">
            Reviewer: <span className="text-destructive">*</span>
          </Label>
          <Input
            id="reviewer-name"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            placeholder="Your name"
            disabled={busy}
            className="h-8 text-sm"
          />
        </div>




        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            pickFile(e.dataTransfer.files?.[0]);
          }}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">
            {file ? file.name : "Drag & drop a PDF label here"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">or</p>
          <input
            id="label-file"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
            disabled={busy}
          />
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={busy}
            onClick={() => document.getElementById("label-file")?.click()}
          >
            Choose PDF
          </Button>
          <p className="text-xs text-muted-foreground mt-3">PDF only · Max 20MB</p>
        </div>

        <div className="flex justify-end items-center gap-2 mt-4">
          {stage === "analyzing" && (
            <span className="text-xs text-muted-foreground mr-auto">
              Analyzing… {elapsed}s
              {mode === "thorough" ? " (typically 45–90s)" : " (typically 15–25s)"}
            </span>
          )}
          {file && !busy && (
            <Button variant="ghost" onClick={() => setFile(null)}>
              Clear
            </Button>
          )}
          <Button
            onClick={handleReview}
            disabled={!file || busy || gummyWeight === null || !reviewerName.trim()}
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {stage === "uploading"
              ? "Uploading…"
              : stage === "analyzing"
              ? `Analyzing… ${elapsed}s`
              : "Review Label"}
          </Button>
        </div>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card className="p-6">
          <h2 className="font-semibold mb-3">Past Reviews</h2>
          <div className="divide-y">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{h.label_file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatET(h.created_at, "MMM d, yyyy h:mm a")} · {h.status}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => viewPastReview(h)}>

                  View
                </Button>
                {h.report_file_path && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => downloadReport(h.report_file_path!, h.label_file_name)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => deleteReview(h.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
