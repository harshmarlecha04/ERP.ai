import { useState } from "react";
import { format } from "date-fns";
import { parseDateString, formatET } from "@/utils/dateUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreVertical, Plus, CheckCircle, XCircle, Calendar, FlaskConical, Download, FlaskRound, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { generateRDVersionPDF } from "@/utils/rdVersionPdfGenerator";
import { useRDProjectVersions, useMarkVersionQAReceived, useRevertVersionToScheduled } from "@/hooks/useRDProjectVersions";
import { useDeleteVersion } from "@/hooks/useRDProjectVersions";
import { ApproveVersionDialog } from "./ApproveVersionDialog";
import { RejectVersionDialog } from "./RejectVersionDialog";
import { AddVersionModal } from "./AddVersionModal";
import { CreateFormulaModal } from "./CreateFormulaModal";
import { StatusBadge } from "./StatusBadge";

interface VersionsListProps {
  projectId: string;
  currentVersionId: string | null;
  projectNumber: string;
  customerName: string;
  formulaReferenceLink?: string | null;
}

export function VersionsList({ 
  projectId, 
  currentVersionId,
  projectNumber,
  customerName,
  formulaReferenceLink
}: VersionsListProps) {
  const { data: versions, isLoading } = useRDProjectVersions(projectId);
  const deleteVersion = useDeleteVersion();
  const markQAReceived = useMarkVersionQAReceived();
  const revertToScheduled = useRevertVersionToScheduled();
  const navigate = useNavigate();


  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addVersionOpen, setAddVersionOpen] = useState(false);
  const [createFormulaOpen, setCreateFormulaOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [formulaVersion, setFormulaVersion] = useState<any>(null);

  const handleApprove = (version: any) => {
    setSelectedVersion(version);
    setApproveDialogOpen(true);
  };

  const handleReject = (version: any) => {
    setSelectedVersion(version);
    setRejectDialogOpen(true);
  };

  const handleDelete = (version: any) => {
    setSelectedVersion(version);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedVersion) {
      await deleteVersion.mutateAsync({
        id: selectedVersion.id,
        rd_project_id: projectId,
      });
      setDeleteDialogOpen(false);
      setSelectedVersion(null);
    }
  };

  const handleDownloadPDF = (version: any) => {
    generateRDVersionPDF(
      projectNumber,
      customerName,
      version,
      formulaReferenceLink
    );

    toast.success("PDF downloaded successfully");
  };

  const handleCreateFormula = (version: any) => {
    setFormulaVersion(version);
    setCreateFormulaOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading versions...</div>;
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">No versions found</p>
        <Button onClick={() => setAddVersionOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add First Version
        </Button>
        <AddVersionModal
          open={addVersionOpen}
          onOpenChange={setAddVersionOpen}
          projectId={projectId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {versions.length} version{versions.length !== 1 ? 's' : ''} total
        </p>
        <Button onClick={() => setAddVersionOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Version
        </Button>
      </div>

      <div className="space-y-3">
        {versions.map((version) => {
          const isScheduled = version.status === 'scheduled' || version.status === 'pending_approval';
          const isQAReceived = version.status === 'qa_received';
          const isApproved = version.status === 'approved';
          const isRejected = version.status === 'rejected';
          const isCurrent = version.id === currentVersionId;
          const canDelete = (isScheduled || isQAReceived) && versions.length > 1;

          return (
            <Card key={version.id} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        Version {version.version_number}
                      </CardTitle>
                      <StatusBadge status={version.status} />
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      Created {formatET(version.created_at, "MMM d, yyyy")}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownloadPDF(version)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCreateFormula(version)}>
                        <FlaskRound className="mr-2 h-4 w-4" />
                        Create Formula
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/tools/supplement-facts?version_id=${version.id}`)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate Supplement Facts
                      </DropdownMenuItem>
                      {isScheduled && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleReject(version)}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </DropdownMenuItem>
                        </>
                      )}
                      {isQAReceived && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleApprove(version)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleReject(version)}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => revertToScheduled.mutate({ id: version.id, rd_project_id: projectId })}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Revert to Scheduled
                          </DropdownMenuItem>
                        </>
                      )}
                      {canDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(version)}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Mold Size:</span>
                    <p className="text-muted-foreground">{(version as any).mold_size || "—"}</p>
                  </div>
                  <div>
                    <span className="font-medium">Color:</span>
                    <p className="text-muted-foreground">{version.color || "—"}</p>
                  </div>
                  <div>
                    <span className="font-medium">Flavor:</span>
                    <p className="text-muted-foreground">{version.flavor || "—"}</p>
                  </div>
                  {version.gummies_count != null && (
                    <div>
                      <span className="font-medium">Gummies Count:</span>
                      <p className="text-muted-foreground">{version.gummies_count.toLocaleString()}</p>
                    </div>
                  )}
                  {version.scheduled_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {formatET(version.scheduled_date, "MMM d, yyyy")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Active Ingredients</span>
                  </div>
                  {version.actives && version.actives.length > 0 ? (
                    <div className="overflow-hidden rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Active Ingredient</th>
                            <th className="text-right px-3 py-2 font-medium w-32">mg/gum</th>
                          </tr>
                        </thead>
                        <tbody>
                          {version.actives.map((active: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="px-3 py-2">{active.active_name}</td>
                              <td className="px-3 py-2 text-right">{active.mg_per_gummy}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">None</p>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Inactive Ingredients</span>
                  </div>
                  {(version as any).inactives && (version as any).inactives.length > 0 ? (
                    <div className="overflow-hidden rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Inactive Ingredient</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(version as any).inactives.map((inactive: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="px-3 py-2">{inactive.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">None</p>
                  )}
                </div>

                {version.notes && (
                  <div className="pt-2 border-t">
                    <span className="text-sm font-medium">Notes:</span>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{version.notes}</p>
                  </div>
                )}

                {isApproved && version.approved_at && (
                  <div className="pt-2 border-t text-sm text-muted-foreground">
                    Approved on {formatET(version.approved_at, "MMM d, yyyy 'at' h:mm a")}
                  </div>
                )}

                {isRejected && (
                  <div className="pt-2 border-t">
                    {version.rejected_at && (
                      <p className="text-sm text-muted-foreground mb-1">
                        Rejected on {formatET(version.rejected_at, "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                    {version.rejection_reason && (
                      <div className="text-sm">
                        <span className="font-medium">Reason:</span>
                        <p className="text-muted-foreground mt-1">{version.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedVersion && (
        <>
          <ApproveVersionDialog
            open={approveDialogOpen}
            onOpenChange={setApproveDialogOpen}
            versionId={selectedVersion.id}
            rdProjectId={projectId}
            versionNumber={selectedVersion.version_number}
            flavor={selectedVersion.flavor}
            color={selectedVersion.color}
            actives={selectedVersion.actives || []}
          />
          <RejectVersionDialog
            open={rejectDialogOpen}
            onOpenChange={setRejectDialogOpen}
            versionId={selectedVersion.id}
            rdProjectId={projectId}
            versionNumber={selectedVersion.version_number}
            flavor={selectedVersion.flavor}
            color={selectedVersion.color}
          />
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Version</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete version {selectedVersion?.version_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddVersionModal
        open={addVersionOpen}
        onOpenChange={setAddVersionOpen}
        projectId={projectId}
      />

      <CreateFormulaModal
        open={createFormulaOpen}
        onOpenChange={setCreateFormulaOpen}
        version={formulaVersion}
        projectNumber={projectNumber}
        customerName={customerName}
        rdProjectId={projectId}
      />
    </div>
  );
}
