import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload, FileText, Image as ImageIcon, Download } from "lucide-react";
import { toast } from "sonner";
import {
  useTaskComments,
  useAddComment,
  useTaskAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  getAttachmentSignedUrl,
} from "@/hooks/launch/useLaunch";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/hooks/useAuth";
import { formatET } from "@/utils/dateUtils";

export function CommentsPanel({ taskId }: { taskId: string }) {
  const { data: comments = [] } = useTaskComments(taskId);
  const { data: profiles = [] } = useProfiles();
  const addComment = useAddComment();
  const [body, setBody] = useState("");
  const map = new Map(
    profiles.map((p: any) => [p.id, p.display_name || p.full_name || p.email])
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="border rounded-lg p-2">
            <div className="text-xs text-muted-foreground flex flex-wrap justify-between gap-x-2 gap-y-0.5">
              <span className="truncate">{map.get(c.author_id) || "Unknown"}</span>
              <span className="shrink-0">{formatET(c.created_at, "MMM d, h:mm a")}</span>
            </div>
            <div className="text-sm mt-1 whitespace-pre-wrap break-words">{c.body}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          className="w-full"
        />
        <div className="flex justify-end">
          <Button
            onClick={async () => {
              if (!body.trim()) return;
              await addComment.mutateAsync({ taskId, body: body.trim() });
              setBody("");
            }}
          >
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AttachmentsPanel({ taskId }: { taskId: string }) {
  const { data: atts = [] } = useTaskAttachments(taskId);
  const upload = useUploadAttachment();
  const del = useDeleteAttachment();
  const { user } = useAuth();

  const handleOpen = async (path: string) => {
    try {
      const url = await getAttachmentSignedUrl(path);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-accent/30">
        <input
          type="file"
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              try {
                await upload.mutateAsync({ taskId, file: f });
              } catch (err: any) {
                const msg = err?.message || "Upload failed";
                toast.error(msg);
              }
            }
            e.target.value = "";
          }}
        />
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Upload className="h-4 w-4" /> Click to upload a file (images, PDF, docs)
        </div>
      </label>

      <div className="space-y-2">
        {atts.length === 0 && (
          <p className="text-sm text-muted-foreground">No attachments.</p>
        )}
        {atts.map((a) => {
          const isImage = a.file_type?.startsWith("image/");
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 border rounded-lg p-2"
            >
              <div className="h-10 w-10 flex items-center justify-center bg-muted rounded">
                {isImage ? (
                  <ImageIcon className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {(a.file_size || 0) > 0
                    ? `${((a.file_size || 0) / 1024).toFixed(1)} KB · `
                    : ""}
                  {formatET(a.uploaded_at, "MMM d, h:mm a")}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => handleOpen(a.storage_path)}>
                <Download className="h-4 w-4" />
              </Button>
              {a.uploaded_by === user?.id && (
                <Button size="icon" variant="ghost" onClick={() => del.mutate(a)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
