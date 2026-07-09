import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Plus, Search, FolderOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useLaunchProjects,
  useLaunchTasks,
  LAUNCH_PROJECT_STATUSES,
} from "@/hooks/launch/useLaunch";
import { useProfiles } from "@/hooks/useProfiles";
import { LaunchProjectDialog } from "@/components/launch/LaunchProjectDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatET } from "@/utils/dateUtils";

const sb = supabase as any;

type Health = "on_track" | "at_risk" | "off_track";

const HEALTH_LABEL: Record<Health, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  off_track: "Off Track",
};

const HEALTH_CLASS: Record<Health, string> = {
  on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  off_track: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

function useLatestSnapshots() {
  return useQuery({
    queryKey: ["projects-list", "latest-snapshots"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("launch_status_snapshots")
        .select("project_id, health, percent_complete, captured_at")
        .order("captured_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, any>();
      for (const row of data || []) {
        if (!map.has(row.project_id)) map.set(row.project_id, row);
      }
      return map;
    },
  });
}

function useOpenRiskCounts() {
  return useQuery({
    queryKey: ["projects-list", "open-risks"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("launch_risks")
        .select("project_id, status")
        .in("status", ["open", "mitigating"]);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.project_id] = (counts[row.project_id] || 0) + 1;
      }
      return counts;
    },
  });
}

export default function ProjectsList() {
  const { data: projects = [], isLoading } = useLaunchProjects();
  const { data: tasks = [] } = useLaunchTasks();
  const { data: profiles = [] } = useProfiles();
  const { data: snapshotMap } = useLatestSnapshots();
  const { data: riskCounts = {} } = useOpenRiskCounts();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const profileMap = useMemo(
    () => new Map((profiles as any[]).map((p) => [p.id, p])),
    [profiles]
  );

  const tasksByProject = useMemo(() => {
    const m: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      if (!t.project_id) continue;
      m[t.project_id] = m[t.project_id] || { total: 0, done: 0 };
      m[t.project_id].total++;
      if (t.status === "done") m[t.project_id].done++;
    }
    return m;
  }, [tasks]);

  const rows = useMemo(() => {
    return projects
      .map((p) => {
        const snap = snapshotMap?.get(p.id);
        const stats = tasksByProject[p.id] || { total: 0, done: 0 };
        const autoPct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
        const health: Health = (snap?.health as Health) || "on_track";
        const pct: number = snap?.percent_complete ?? autoPct;
        const openRisks = riskCounts[p.id] || 0;
        const openTasks = stats.total - stats.done;
        const owner = p.owner_id ? profileMap.get(p.owner_id) : null;
        return {
          ...p,
          health,
          pct,
          openRisks,
          openTasks,
          totalTasks: stats.total,
          lastUpdate: snap?.captured_at as string | undefined,
          ownerName: owner?.display_name || owner?.full_name || owner?.email || "—",
        };
      })
      .filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (healthFilter !== "all" && r.health !== healthFilter) return false;
        if (ownerFilter !== "all" && r.owner_id !== ownerFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (
            !r.name.toLowerCase().includes(q) &&
            !(r.code || "").toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      });
  }, [projects, snapshotMap, riskCounts, tasksByProject, profileMap, statusFilter, healthFilter, ownerFilter, search]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            All active and historical product launch projects in one place.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Project
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code…"
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {LAUNCH_PROJECT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={healthFilter} onValueChange={setHealthFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Health" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All health</SelectItem>
              <SelectItem value="on_track">On Track</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="off_track">Off Track</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {(profiles as any[]).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name || p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading projects…</div>
          ) : rows.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-60" />
              <p className="mb-3">No projects match your filters.</p>
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Create your first project
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead className="w-[160px]">Progress</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Risks</TableHead>
                  <TableHead className="text-right">Open Tasks</TableHead>
                  <TableHead>Last Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <Link to={`/projects/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.code || "—"}</TableCell>
                    <TableCell className="text-sm">{r.ownerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {r.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={HEALTH_CLASS[r.health]}>
                        {HEALTH_LABEL[r.health]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${r.pct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums w-8 text-right">{r.pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.target_date
                        ? formatET(r.target_date, "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.openRisks > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-sm">
                          <AlertTriangle className="h-3.5 w-3.5" /> {r.openRisks}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{r.openTasks}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.lastUpdate
                        ? formatET(r.lastUpdate, "MMM d, yyyy")
                        : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LaunchProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
