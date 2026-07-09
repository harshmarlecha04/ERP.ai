import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useRDProject,
  useDeleteRDProject,
} from "@/hooks/useRDProjects";
import { StatusBadge } from "./StatusBadge";
import { AddRDProjectModal } from "./AddRDProjectModal";
import { ConvertToProductionDialog } from "./ConvertToProductionDialog";
import { VersionsList } from "./VersionsList";
import { ReceivedSamplesList } from "./ReceivedSamplesList";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { formatET } from "@/utils/dateUtils";

interface RDProjectDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  defaultTab?: "overview" | "versions" | "received" | "conversion";
}

export const RDProjectDetailModal = ({
  open,
  onOpenChange,
  projectId,
  defaultTab = "overview",
}: RDProjectDetailModalProps) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: project } = useRDProject(projectId);
  const deleteProject = useDeleteRDProject();
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!projectId) return;
    await deleteProject.mutateAsync(projectId);
    onOpenChange(false);
  };

  const handleViewFormula = () => {
    if (project?.converted_to_formula_id) {
      navigate(`/formula/view/${project.converted_to_formula_id}`);
      onOpenChange(false);
    }
  };

  if (!project) return null;

  const canConvert = project.status === "approved" && !project.converted_to_formula_id;
  const isConverted = project.status === "converted_to_production";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="[--dialog-max-width:64rem] w-full max-h-[90vh] overflow-y-auto" style={{ width: 'min(64rem, calc(100vw - 2rem))' }}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <DialogTitle className="text-2xl">{project.project_number}</DialogTitle>
                <p className="text-lg font-semibold text-muted-foreground">{project.project_name}</p>
                <StatusBadge status={project.status} />
              </div>
              <div className="flex gap-2">
                {!isConverted && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditModalOpen(true)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </>
                )}
                {canConvert && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setConvertDialogOpen(true)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Convert to Production
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs key={defaultTab} defaultValue={defaultTab} className="mt-4">
            <TabsList className={cn("grid w-full", isConverted ? "grid-cols-4" : "grid-cols-3")}>
              <TabsTrigger value="overview" className="w-full">Project Overview</TabsTrigger>
              <TabsTrigger value="versions" className="w-full">
                Versions {project.version_count > 0 && `(${project.version_count})`}
              </TabsTrigger>
              <TabsTrigger value="received" className="w-full">Received Samples</TabsTrigger>
              {isConverted && (
                <TabsTrigger value="conversion" className="w-full">Conversion History</TabsTrigger>
              )}
            </TabsList>


            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Project Name</h3>
                  <p>{project.project_name}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Customer</h3>
                  <p>{project.customer_name}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Created</h3>
                  <p>{formatET(project.created_at, "MMM d, yyyy")}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Flavor</h3>
                  <p>{project.flavor}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Color</h3>
                  <p>{project.color}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Mold Size</h3>
                  <p>
                    {project.current_version?.mold_size || (project as any).mold_size || (
                      <span className="text-muted-foreground">Not specified</span>
                    )}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Number of Gummies</h3>
                  <p>
                    {project.gummies_count ? 
                      `${project.gummies_count.toLocaleString()} gummies` : 
                      <span className="text-muted-foreground">Not specified</span>
                    }
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Scheduled R&D Date</h3>
                  <p>
                    {project.scheduled_date ? 
                      formatET(project.scheduled_date, "MMMM d, yyyy") : 
                      <span className="text-muted-foreground">Not scheduled</span>
                    }
                  </p>
                </div>
              </div>

              {project.formula_reference_link && (
                <div className="space-y-2">
                  <h3 className="font-semibold">R&D Formula Reference</h3>
                  <div className="flex items-center gap-2">
                    <a
                      href={project.formula_reference_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm break-all"
                    >
                      {project.formula_reference_link}
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(project.formula_reference_link, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Active Ingredients</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Active Name</TableHead>
                      <TableHead>mg/gummy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.current_version?.actives?.map((active: any) => (
                      <TableRow key={active.id}>
                        <TableCell>{active.active_name}</TableCell>
                        <TableCell>{active.mg_per_gummy} mg</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {project.notes && (
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{project.notes}</p>
                </div>
              )}

              {project.rejection_reason && (
                <div className="bg-destructive/10 border border-destructive p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-destructive">Rejection Reason</h3>
                  <p className="text-sm">{project.rejection_reason}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="received" className="space-y-4">
              <ReceivedSamplesList projectId={project.id} projectNumber={project.project_number} />
            </TabsContent>


            <TabsContent value="versions" className="space-y-4">
              <VersionsList
                projectId={project.id}
                currentVersionId={project.current_version_id}
                projectNumber={project.project_number}
                customerName={project.customer_name}
                formulaReferenceLink={project.formula_reference_link}
              />
            </TabsContent>

            {isConverted && (
              <TabsContent value="conversion" className="space-y-4">
                <div className="bg-success/10 border border-success p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Converted to Production Formula</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    This R&D project was successfully converted on{" "}
                    {project.converted_at &&
                      formatET(project.converted_at, "MMM d, yyyy")}
                  </p>
                  <Button onClick={handleViewFormula}>View Production Formula</Button>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      <AddRDProjectModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        editingProject={project}
      />

      <ConvertToProductionDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        project={project}
        onSuccess={handleViewFormula}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete R&D Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {project.project_number}? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};