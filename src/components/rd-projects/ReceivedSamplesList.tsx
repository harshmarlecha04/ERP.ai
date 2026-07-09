import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Edit, Plus, Trash2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseDateString, formatET } from "@/utils/dateUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RDReceivedSample,
  useDeleteRDReceivedSample,
  useMarkRDSampleReceived,
  useRDReceivedSamples,
} from "@/hooks/useRDReceivedSamples";
import { useRDProjectVersions } from "@/hooks/useRDProjectVersions";
import { ReceivedSampleModal } from "./ReceivedSampleModal";


interface Props {
  projectId: string;
  projectNumber?: string | null;
}

export const ReceivedSamplesList = ({ projectId, projectNumber }: Props) => {

  const { data: samples = [], isLoading } = useRDReceivedSamples(projectId);
  const { data: versions = [] } = useRDProjectVersions(projectId);
  const versionMap = new Map<string, number>(
    (versions || []).map((v: any) => [
      v.id as string,
      parseInt(String(v.version_number ?? "").replace(/\D/g, ""), 10) || 0,
    ])
  );
  const markReceived = useMarkRDSampleReceived();
  const deleteSample = useDeleteRDReceivedSample();


  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RDReceivedSample | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RDReceivedSample | null>(null);

  const fmtDate = (s: string | null) =>
    s ? formatET(s, "MMM d, yyyy") : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Received Samples</h3>
          <p className="text-sm text-muted-foreground">
            Log physical samples received at the facility and confirm receipt.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Log Sample
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : samples.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
          No samples logged yet.
        </div>
      ) : (
        <div className="space-y-3">
          {samples.map((s, i) => {
            const isReceived = !!s.received_at;
            const sampleNum = samples.length - i;
            const linkedVersion = s.rd_version_id ? versionMap.get(s.rd_version_id) : undefined;
            // Fallback: infer version by chronological order (oldest sample = V1)
            const inferredVersion = linkedVersion ?? sampleNum;
            let defaultTitle: string;
            if (projectNumber) {
              defaultTitle = inferredVersion > 1 ? `${projectNumber}-V${inferredVersion}` : projectNumber;
            } else {
              defaultTitle = `Sample ${sampleNum}`;
            }

            return (
              <div
                key={s.id}
                className="border rounded-lg p-4 space-y-3 bg-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <PackageCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {s.product_name || defaultTitle}
                      </span>

                      {s.mold_size && (
                        <Badge variant="outline">{s.mold_size}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      LOT {s.lot_number || "—"} · For {s.customer_name || "—"}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(s);
                        setModalOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(s)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Received</div>
                    <div>{fmtDate(s.received_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Made on</div>
                    <div>{fmtDate(s.made_on_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Flavor</div>
                    <div>{s.flavor || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Color</div>
                    <div>{s.color || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Quantity on Hand (gummies)</div>
                    <div>{s.quantity_on_hand != null ? s.quantity_on_hand.toLocaleString() : "—"}</div>
                  </div>
                </div>


                <div className="flex items-center justify-between pt-2 border-t">
                  {isReceived ? (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        Received by{" "}
                        <span className="font-medium">
                          {s.received_by_name || "Unknown"}
                        </span>{" "}
                        ·{" "}
                        {s.received_at &&
                          formatET(s.received_at, "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Awaiting receipt confirmation
                    </span>
                  )}
                  {!isReceived && (
                    <Button
                      size="sm"
                      onClick={() => setConfirmId(s.id)}
                      disabled={markReceived.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Mark as Received
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ReceivedSampleModal
        open={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) setEditing(null);
        }}
        projectId={projectId}
        editing={editing}
      />

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm receipt</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm that you have received this sample. Your name and the current
              date/time will be recorded for tracking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmId) {
                  await markReceived.mutateAsync({ id: confirmId });
                  setConfirmId(null);
                }
              }}
            >
              Confirm Receipt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sample entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the sample log. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteTarget) {
                  await deleteSample.mutateAsync({
                    id: deleteTarget.id,
                    rd_project_id: deleteTarget.rd_project_id,
                  });
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
