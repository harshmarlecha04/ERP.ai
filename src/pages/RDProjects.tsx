import { useState, useMemo } from "react";
import { parseDateString, formatET } from "@/utils/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, MoreVertical, Edit, Trash2, Eye, CheckCircle2, XCircle, Download, PackageCheck, ExternalLink, Copy, CalendarIcon, X, List, FlaskRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RDProjectsCalendar } from "@/components/rd-projects/RDProjectsCalendar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, addDays, subDays } from "date-fns";
import { toast } from "sonner";
import { generateRDVersionPDF } from "@/utils/rdVersionPdfGenerator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useRDProjects, useDeleteRDProject, useDuplicateRDProject } from "@/hooks/useRDProjects";
import { useMarkVersionQAReceived, useRevertVersionToScheduled } from "@/hooks/useRDProjectVersions";
import { AddRDProjectModal } from "@/components/rd-projects/AddRDProjectModal";
import { RDBaseTemplatesModal } from "@/components/rd-projects/RDBaseTemplatesModal";
import { RDProjectDetailModal } from "@/components/rd-projects/RDProjectDetailModal";
import { AddVersionModal } from "@/components/rd-projects/AddVersionModal";
import { CreateFormulaModal } from "@/components/rd-projects/CreateFormulaModal";
import { ApproveVersionDialog } from "@/components/rd-projects/ApproveVersionDialog";
import { RejectVersionDialog } from "@/components/rd-projects/RejectVersionDialog";
import { StatusBadge } from "@/components/rd-projects/StatusBadge";
import { ReceivedSampleModal } from "@/components/rd-projects/ReceivedSampleModal";
import { useRDReceivedSamplesCounts, useMarkRDSampleReceived, type RDReceivedSample } from "@/hooks/useRDReceivedSamples";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

const RDProjects = () => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [baseTemplatesOpen, setBaseTemplatesOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [receivedModalOpen, setReceivedModalOpen] = useState(false);
  const [receivedProjectId, setReceivedProjectId] = useState<string | null>(null);
  const [receivedDefaultFlavor, setReceivedDefaultFlavor] = useState<string>("");
  const [receivedDefaultMadeOnDate, setReceivedDefaultMadeOnDate] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [detailDefaultTab, setDetailDefaultTab] = useState<"overview" | "versions" | "received" | "conversion">("overview");
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedEditVersion, setSelectedEditVersion] = useState<any>(null);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [createFormulaOpen, setCreateFormulaOpen] = useState(false);
  const [formulaContext, setFormulaContext] = useState<{ version: any; projectNumber: string; customerName: string; rdProjectId: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("scheduled_date_desc");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const applyPreset = (preset: string) => {
    const today = new Date();
    switch (preset) {
      case "past_30": setFromDate(subDays(today, 30)); setToDate(today); break;
      case "next_30": setFromDate(today); setToDate(addDays(today, 30)); break;
      case "this_month": setFromDate(startOfMonth(today)); setToDate(endOfMonth(today)); break;
      case "this_quarter": setFromDate(startOfQuarter(today)); setToDate(endOfQuarter(today)); break;
      case "this_year": setFromDate(startOfYear(today)); setToDate(endOfYear(today)); break;
      case "all": setFromDate(undefined); setToDate(undefined); break;
    }
  };

  // Confirmation card after a sample is logged
  const [confirmCard, setConfirmCard] = useState<{ sample: RDReceivedSample; projectNumber: string } | null>(null);
  const markReceived = useMarkRDSampleReceived();

  const { data: projects = [], isLoading } = useRDProjects();
  const deleteProject = useDeleteRDProject();
  const duplicateProject = useDuplicateRDProject();
  const markQAReceived = useMarkVersionQAReceived();
  const revertToScheduled = useRevertVersionToScheduled();

  const handleMarkQAReceived = (project: any, version: any) => {
    if (!version?.id) return;
    markQAReceived.mutate({ id: version.id, rd_project_id: project.id });
  };
  const handleRevertToScheduled = (project: any, version: any) => {
    if (!version?.id) return;
    revertToScheduled.mutate({ id: version.id, rd_project_id: project.id });
  };
  const projectIds = useMemo(() => (projects as any[]).map((p) => p.id), [projects]);
  const { data: receivedCounts = {} } = useRDReceivedSamplesCounts(projectIds);

  // Flatten: one row per version (or one fallback row for projects with no versions)
  const filteredRows = useMemo(() => {
    type Row = {
      project: any;
      version: any | null;
      isCurrent: boolean;
      isFirstOfProject: boolean;
      versionIndex: number;
      versionCount: number;
    };

    const search = searchTerm.toLowerCase();
    const projRows: Row[] = [];

    (projects as any[]).forEach((project: any) => {
      const allVersions: any[] = Array.isArray(project.versions) ? [...project.versions] : [];
      // newest first by created_at
      allVersions.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const projectMatchesSearch =
        !search ||
        (project.project_number || "").toLowerCase().includes(search) ||
        (project.customer_name || "").toLowerCase().includes(search) ||
        (project.project_name || "").toLowerCase().includes(search);

      const sourceVersions = allVersions.length > 0 ? allVersions : [null];

      const projectVersionRows: Row[] = [];
      sourceVersions.forEach((v, idx) => {
        // Per-row filters
        const matchesSearch =
          projectMatchesSearch ||
          (v?.flavor || "").toLowerCase().includes(search) ||
          (v?.version_number || "").toLowerCase().includes(search);

        const matchesStatus =
          statusFilter === "all" || v?.status === statusFilter;

        let matchesDate = true;
        if (fromDate || toDate) {
          const sd = v?.scheduled_date;
          if (!sd) {
            matchesDate = false;
          } else {
            const t = parseDateString(sd).getTime();
            if (fromDate) {
              const fromT = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime();
              if (t < fromT) matchesDate = false;
            }
            if (matchesDate && toDate) {
              const toT = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999).getTime();
              if (t > toT) matchesDate = false;
            }
          }
        }

        if (!matchesSearch || !matchesStatus || !matchesDate) return;

        projectVersionRows.push({
          project,
          version: v,
          isCurrent: !!v && v.id === project.current_version_id,
          isFirstOfProject: false,
          versionIndex: idx,
          versionCount: allVersions.length,
        });
      });

      if (projectVersionRows.length > 0) {
        projectVersionRows[0].isFirstOfProject = true;
        projRows.push(...projectVersionRows);
      }
    });

    // Sort: keep project groups together. Sort projects by chosen key, then versions newest-first within group.
    const projectKey = (p: any) => p.id;
    const projectSortValue = (p: any): number => {
      switch (sortBy) {
        case "recently_added":
          return new Date(p.created_at).getTime();
        case "recently_updated":
          return new Date(p.updated_at).getTime();
        case "scheduled_date_desc":
        case "scheduled_date_asc": {
          // use the newest scheduled date among this project's versions
          const dates = (p.versions || [])
            .map((v: any) => v?.scheduled_date)
            .filter(Boolean)
            .map((d: string) => parseDateString(d).getTime());
          if (dates.length === 0) return sortBy === "scheduled_date_asc" ? Infinity : -Infinity;
          return sortBy === "scheduled_date_asc" ? Math.min(...dates) : Math.max(...dates);
        }
        default:
          return 0;
      }
    };

    const grouped = new Map<string, Row[]>();
    projRows.forEach((r) => {
      const k = projectKey(r.project);
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(r);
    });

    const sortedProjectKeys = Array.from(grouped.keys()).sort((a, b) => {
      const pa = grouped.get(a)![0].project;
      const pb = grouped.get(b)![0].project;
      const va = projectSortValue(pa);
      const vb = projectSortValue(pb);
      if (sortBy === "scheduled_date_asc") return va - vb;
      return vb - va;
    });

    const result: Row[] = [];
    sortedProjectKeys.forEach((k) => result.push(...grouped.get(k)!));
    return result;
  }, [projects, searchTerm, statusFilter, sortBy, fromDate, toDate]);

  const handleRowClick = (projectId: string, tab: "overview" | "versions" | "received" | "conversion" = "overview") => {
    setSelectedProjectId(projectId);
    setDetailDefaultTab(tab);
    setDetailModalOpen(true);
  };

  const handleEdit = (project: any, version?: any) => {
    setSelectedProject(project);
    setSelectedEditVersion(version || project.current_version || null);
    setAddModalOpen(true);
  };


  const handleAddVersion = (project: any) => {
    setSelectedProjectId(project.id);
    setVersionModalOpen(true);
  };

  const handleDelete = (project: any) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  const handleApprove = (project: any) => {
    const currentVersion = project.current_version;
    if (currentVersion) {
      setSelectedVersion({
        id: currentVersion.id,
        rd_project_id: project.id,
        version_number: currentVersion.version_number,
        flavor: currentVersion.flavor,
        color: currentVersion.color,
        actives: currentVersion.actives || [],
      });
      setApproveDialogOpen(true);
    }
  };

  const handleReject = (project: any) => {
    const currentVersion = project.current_version;
    if (currentVersion) {
      setSelectedVersion({
        id: currentVersion.id,
        rd_project_id: project.id,
        version_number: currentVersion.version_number,
        flavor: currentVersion.flavor,
        color: currentVersion.color,
      });
      setRejectDialogOpen(true);
    }
  };

  const handleDownloadPDF = (project: any) => {
    if (!project.current_version) {
      toast.error("No version available to download");
      return;
    }
    
    generateRDVersionPDF(
      project.project_number,
      project.customer_name,
      project.current_version,
      project.formula_reference_link,
      project.project_name
    );
    
    toast.success("PDF downloaded successfully");
  };

  const handleCreateFormula = (project: any) => {
    if (!project.current_version) {
      toast.error("Add a version first");
      return;
    }
    setFormulaContext({
      version: project.current_version,
      projectNumber: project.project_number,
      customerName: project.customer_name,
      rdProjectId: project.id,
    });
    setCreateFormulaOpen(true);
  };



  const confirmDelete = () => {
    if (selectedProject) {
      deleteProject.mutate(selectedProject.id);
      setDeleteDialogOpen(false);
      setSelectedProject(null);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">R&D Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage research & development projects and sample batches
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBaseTemplatesOpen(true)}>
            <List className="h-4 w-4 mr-2" />
            Base Templates
          </Button>
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New R&D Project
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by project number, name, customer, or flavor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="qa_received">QA Received</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="converted_to_production">Converted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recently_added">Recently Added</SelectItem>
            <SelectItem value="recently_updated">Recently Updated</SelectItem>
            <SelectItem value="scheduled_date_desc">Scheduled Date (Newest First)</SelectItem>
            <SelectItem value="scheduled_date_asc">Scheduled Date (Oldest First)</SelectItem>
          </SelectContent>
        </Select>
        <Select onValueChange={applyPreset}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Date presets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="past_30">Past 30 days</SelectItem>
            <SelectItem value="next_30">Next 30 days</SelectItem>
            <SelectItem value="this_month">This month</SelectItem>
            <SelectItem value="this_quarter">This quarter</SelectItem>
            <SelectItem value="this_year">This year</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal w-[170px]", !fromDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {fromDate ? format(fromDate, "MMM d, yyyy") : "From date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" onClick={(e) => e.stopPropagation()}>
            <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal w-[170px]", !toDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {toDate ? format(toDate, "MMM d, yyyy") : "To date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" onClick={(e) => e.stopPropagation()}>
            <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {(fromDate || toDate) && (
          <Button variant="ghost" size="sm" onClick={() => { setFromDate(undefined); setToDate(undefined); }}>
            <X className="h-4 w-4 mr-1" /> Clear dates
          </Button>
        )}
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "list" | "calendar")}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="list">
            <List className="h-4 w-4 mr-2" />
            List
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No R&D projects found</p>
          <Button onClick={() => setAddModalOpen(true)} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Create Your First R&D Project
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project #</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Flavor & Color</TableHead>
                <TableHead>Actives</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-[70px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const project = row.project;
                const version = row.version;
                const isCurrent = row.isCurrent;
                const isFirst = row.isFirstOfProject;
                const hasMultiple = (row.versionCount ?? 0) > 1;
                return (
                  <TableRow
                    key={`${project.id}-${version?.id || "novers"}`}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-muted/50",
                      hasMultiple && "bg-[hsl(80_55%_88%)] hover:bg-[hsl(80_55%_82%)] dark:bg-[hsl(80_25%_20%)] dark:hover:bg-[hsl(80_25%_26%)]",
                      hasMultiple && !isFirst && "border-l-4 border-l-[hsl(80_45%_45%)]"
                    )}
                    onClick={() => handleRowClick(project.id, isCurrent || !version ? "overview" : "versions")}
                  >




                    <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const isOnlyOrCurrent =
                          row.versionCount <= 1 || (version && version.id === project.current_version_id);
                        const displayNumber = isOnlyOrCurrent || !version?.version_number
                          ? project.project_number
                          : `${project.project_number}-${String(version.version_number).toUpperCase()}`;
                        return (
                          <button
                            type="button"
                            onClick={() => handleRowClick(project.id, "received")}
                            className={cn(
                              "text-primary hover:underline inline-flex items-center gap-1",
                              !isFirst && "pl-4 text-sm"
                            )}
                            title="View received sample details"
                          >
                            {!isFirst && <span className="text-muted-foreground mr-1">↳</span>}
                            {displayNumber}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </button>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {isFirst ? (project.project_name || "Untitled") : <span className="text-muted-foreground pl-4">—</span>}
                    </TableCell>
                    <TableCell>{isFirst ? project.customer_name : ""}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          {version?.version_number || "No versions"}
                          {isCurrent && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">Current</Badge>
                          )}
                        </div>
                        {isFirst && (
                          <div className="text-xs text-muted-foreground">
                            {row.versionCount} version{row.versionCount !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{version?.flavor || "-"}</div>
                        <div className="text-xs text-muted-foreground">{version?.color || "-"}</div>
                        {(version as any)?.mold_size && (
                          <div className="text-xs text-muted-foreground italic">{(version as any).mold_size}</div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>{version?.actives?.length || 0} actives</TableCell>
                    <TableCell>
                      {version?.scheduled_date ?
                        formatET(version.scheduled_date, "MMM d, yyyy") :
                        <span className="text-muted-foreground">Not scheduled</span>
                      }
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={version?.status || "scheduled"} />
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {formatET(version?.updated_at || project.updated_at, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(project, version)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Project
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => duplicateProject.mutate(project.id)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate Project
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAddVersion(project)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Version
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRowClick(project.id, "versions")}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Versions
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPDF(project)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCreateFormula(project)}>
                            <FlaskRound className="h-4 w-4 mr-2" />
                            Create Formula
                          </DropdownMenuItem>



                          {(version?.status === 'scheduled' || version?.status === 'pending_approval') && (
                            <>
                              <DropdownMenuSeparator />


                              <DropdownMenuItem onClick={() => handleReject(project)}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject Version
                              </DropdownMenuItem>
                            </>
                          )}

                          {version?.status === 'qa_received' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleApprove(project)}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Approve Version
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReject(project)}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject Version
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRevertToScheduled(project, version)}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Revert to Scheduled
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(project)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}


            </TableBody>
          </Table>
        </div>
      )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <RDProjectsCalendar
            projects={projects as any[]}
            onProjectClick={(id) => handleRowClick(id)}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      <ReceivedSampleModal
        open={receivedModalOpen}
        onOpenChange={(open) => {
          setReceivedModalOpen(open);
          if (!open) {
            setReceivedProjectId(null);
            setReceivedDefaultFlavor("");
            setReceivedDefaultMadeOnDate(null);
          }
        }}
        projectId={receivedProjectId}
        defaultFlavor={receivedDefaultFlavor}
        defaultMadeOnDate={receivedDefaultMadeOnDate}
        onCreated={(sample) => {
          const proj = (projects as any[]).find((p) => p.id === sample.rd_project_id);
          setConfirmCard({ sample, projectNumber: proj?.project_number || "" });
        }}
      />

      <RDBaseTemplatesModal open={baseTemplatesOpen} onOpenChange={setBaseTemplatesOpen} />
      <AddRDProjectModal 
        open={addModalOpen} 
        onOpenChange={(open) => {
          setAddModalOpen(open);
          if (!open) {
            setSelectedProject(null);
            setSelectedEditVersion(null);
          }
        }}
        editingProject={selectedProject}
        editingVersion={selectedEditVersion}
      />

      <AddVersionModal
        open={versionModalOpen}
        onOpenChange={setVersionModalOpen}
        projectId={selectedProjectId}
      />

      {formulaContext && (
        <CreateFormulaModal
          open={createFormulaOpen}
          onOpenChange={(v) => { setCreateFormulaOpen(v); if (!v) setFormulaContext(null); }}
          version={formulaContext.version}
          projectNumber={formulaContext.projectNumber}
          customerName={formulaContext.customerName}
          rdProjectId={formulaContext.rdProjectId}
        />
      )}
      <RDProjectDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        projectId={selectedProjectId}
        defaultTab={detailDefaultTab}
      />

      {/* Confirmation card after Log Sample */}
      <AlertDialog open={!!confirmCard} onOpenChange={(o) => !o && setConfirmCard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Sample logged successfully
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Sample for <span className="font-semibold text-foreground">{confirmCard?.projectNumber}</span> has been added to the project.
                </p>
                <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 text-foreground">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Flavor</div>
                      <div>{confirmCard?.sample.flavor || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Color</div>
                      <div>{confirmCard?.sample.color || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">LOT #</div>
                      <div>{confirmCard?.sample.lot_number || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Mold size</div>
                      <div>{confirmCard?.sample.mold_size || "—"}</div>
                    </div>
                  </div>
                  {confirmCard?.sample.received_at ? (
                    <div className="text-xs text-success pt-1">
                      Received by {confirmCard.sample.received_by_name || "Unknown"} ·{" "}
                      {formatET(confirmCard.sample.received_at, "MMM d, yyyy h:mm a")}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground pt-1">
                      Awaiting receipt confirmation. Confirming records your name and timestamp.
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Close</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (!confirmCard) return;
                const projectId = confirmCard.sample.rd_project_id;
                setConfirmCard(null);
                handleRowClick(projectId, "received");
              }}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </Button>
            {!confirmCard?.sample.received_at && (
              <AlertDialogAction
                onClick={async (e) => {
                  e.preventDefault();
                  if (!confirmCard) return;
                  const updated = await markReceived.mutateAsync({ id: confirmCard.sample.id });
                  setConfirmCard({ sample: updated, projectNumber: confirmCard.projectNumber });
                }}
                disabled={markReceived.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Mark as Received Now
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete R&D Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete project {selectedProject?.project_number}? This will delete all versions and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedVersion && (
        <>
          <ApproveVersionDialog
            open={approveDialogOpen}
            onOpenChange={(open) => {
              setApproveDialogOpen(open);
              if (!open) setSelectedVersion(null);
            }}
            versionId={selectedVersion.id}
            rdProjectId={selectedVersion.rd_project_id}
            versionNumber={selectedVersion.version_number}
            flavor={selectedVersion.flavor}
            color={selectedVersion.color}
            actives={selectedVersion.actives}
          />
          <RejectVersionDialog
            open={rejectDialogOpen}
            onOpenChange={(open) => {
              setRejectDialogOpen(open);
              if (!open) setSelectedVersion(null);
            }}
            versionId={selectedVersion.id}
            rdProjectId={selectedVersion.rd_project_id}
            versionNumber={selectedVersion.version_number}
            flavor={selectedVersion.flavor}
            color={selectedVersion.color}
          />
        </>
      )}
    </div>
  );
};

export default RDProjects;