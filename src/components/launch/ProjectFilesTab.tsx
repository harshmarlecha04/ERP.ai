import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { FileText, Image as ImageIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAttachmentSignedUrl } from "@/hooks/launch/useLaunch";
import { useProfiles } from "@/hooks/useProfiles";
import { toast } from "sonner";

const sb = supabase as any;

export function ProjectFilesTab({ projectId }: { projectId: string }) {
  const { data: profiles = [] } = useProfiles();
  const profileMap = new Map(profiles.map((p: any) => [p.id, p.display_name || p.full_name || p.email]));

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["launch", "project_files", projectId],
    queryFn: async () => {
      const { data: tasks, error: te } = await sb
        .from("launch_tasks")
        .select("id,title")
        .eq("project_id", projectId);
      if (te) throw te;
      const taskIds = (tasks || []).map((t: any) => t.id);
      if (taskIds.length === 0) return [];
      const taskMap = new Map((tasks || []).map((t: any) => [t.id, t.title]));
      const { data, error } = await sb
        .from("launch_attachments")
        .select("*")
        .in("task_id", taskIds)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((a: any) => ({ ...a, task_title: taskMap.get(a.task_id) }));
    },
  });

  const open = async (path: string) => {
    try {
      const url = await getAttachmentSignedUrl(path);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Failed to open file");
    }
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading files…</div>;

  if (files.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground border-2 border-dashed rounded-xl">
        No files in this project yet. Upload attachments from a task to see them here.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card divide-y">
      {files.map((f: any) => {
        const isImage = f.file_type?.startsWith("image/");
        return (
          <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{f.file_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {f.task_title} · {profileMap.get(f.uploaded_by) || "Unknown"} ·{" "}
                {format(parseISO(f.uploaded_at), "MMM d, yyyy")}
              </div>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums shrink-0">
              {((f.file_size || 0) / 1024).toFixed(1)} KB
            </div>
            <Button size="icon" variant="ghost" onClick={() => open(f.storage_path)}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
