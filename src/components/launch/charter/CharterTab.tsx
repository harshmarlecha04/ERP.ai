import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Plus,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  CircleDot,
  Pencil,
  Trash2,
  Save,
  CameraIcon,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useProfiles } from "@/hooks/useProfiles";
import {
  useCharter,
  useUpsertCharter,
  useStakeholders,
  useAddStakeholder,
  useDeleteStakeholder,
  useRisks,
  useUpsertRisk,
  useDeleteRisk,
  useMilestonesFull,
  useUpsertMilestone,
  useSignoffMilestone,
  useDeleteMilestone,
  useSnapshots,
  useCaptureSnapshot,
  type LaunchRisk,
  type LaunchMilestoneFull,
  type Health,
  type RACI,
  type LaunchStakeholder,
} from "@/hooks/launch/useCharter";
import { useLaunchTasks } from "@/hooks/launch/useLaunch";
import { formatET } from "@/utils/dateUtils";

interface Props {
  projectId: string;
  projectName: string;
  projectOwnerId: string | null;
  startDate: string | null;
  targetDate: string | null;
}

const RACI_LABEL: Record<RACI, string> = {
  R: "Responsible",
  A: "Accountable",
  C: "Consulted",
  I: "Informed",
};

const RACI_COLOR: Record<RACI, string> = {
  R: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  A: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  C: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  I: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function CharterTab({
  projectId,
  projectName,
  projectOwnerId,
  startDate,
  targetDate,
}: Props) {
  const { data: profiles = [] } = useProfiles();
  const profileMap = useMemo(
    () => new Map(profiles.map((p: any) => [p.id, p.display_name || p.full_name || p.email])),
    [profiles]
  );

  const { data: charter } = useCharter(projectId);
  const { data: stakeholders = [] } = useStakeholders(projectId);
  const { data: risks = [] } = useRisks(projectId);
  const { data: milestones = [] } = useMilestonesFull(projectId);
  const { data: snapshots = [] } = useSnapshots(projectId);
  const { data: tasks = [] } = useLaunchTasks({ projectId });

  // Auto-derived health for the snapshot dialog
  const taskPct = useMemo(() => {
    if (!tasks.length) return 0;
    const done = tasks.filter((t) => t.status === "done").length;
    return Math.round((done / tasks.length) * 100);
  }, [tasks]);

  const milestonesDone = milestones.filter((m) => m.status === "done").length;
  const openRisks = risks.filter((r) => r.status === "open" || r.status === "mitigating").length;
  const highRisks = risks.filter(
    (r) => (r.likelihood * r.impact >= 6) && (r.status === "open" || r.status === "mitigating")
  ).length;

  const derivedHealth: Health = useMemo(() => {
    let elapsedPct = 0;
    if (startDate && targetDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(targetDate).getTime();
      const now = Date.now();
      if (end > start) elapsedPct = Math.round(((now - start) / (end - start)) * 100);
    }
    if (highRisks >= 2 || taskPct + 25 < elapsedPct) return "off_track";
    if (highRisks >= 1 || taskPct + 10 < elapsedPct) return "at_risk";
    return "on_track";
  }, [taskPct, startDate, targetDate, highRisks]);

  const lastSnapshot = snapshots[0];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header health bar */}
      <Card className="p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold">{projectName} — Charter</h2>
            <p className="text-sm text-muted-foreground">
              Living single-page summary of scope, people, milestones and risk.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <HealthBadge health={derivedHealth} label="Current health" />
            <MetricChip label="Progress" value={`${taskPct}%`} />
            <MetricChip label="Milestones" value={`${milestonesDone}/${milestones.length}`} />
            <MetricChip
              label="Open risks"
              value={String(openRisks)}
              tone={highRisks > 0 ? "danger" : "default"}
            />
            <CaptureSnapshotButton
              projectId={projectId}
              defaults={{
                health: derivedHealth,
                percent_complete: taskPct,
                open_risks_count: openRisks,
                milestones_done: milestonesDone,
                milestones_total: milestones.length,
              }}
            />
          </div>
        </div>
        {lastSnapshot && (
          <p className="text-xs text-muted-foreground mt-3">
            Last status: {format(parseISO(lastSnapshot.captured_at), "MMM d, h:mma")} —{" "}
            {lastSnapshot.health.replace("_", " ")} ({lastSnapshot.percent_complete}%)
          </p>
        )}
      </Card>

      {/* Charter info */}
      <CharterInfoCard
        projectId={projectId}
        charter={charter ?? null}
        profileMap={profileMap}
        defaultOwner={projectOwnerId}
      />

      {/* Stakeholders RACI */}
      <StakeholdersCard
        projectId={projectId}
        stakeholders={stakeholders}
        profileMap={profileMap}
        profiles={profiles}
      />

      {/* Milestones */}
      <MilestonesCard
        projectId={projectId}
        milestones={milestones}
        profileMap={profileMap}
        profiles={profiles}
      />

      {/* Risk register */}
      <RisksCard
        projectId={projectId}
        risks={risks}
        profileMap={profileMap}
        profiles={profiles}
      />

      {/* Status history */}
      <SnapshotsHistory snapshots={snapshots} profileMap={profileMap} />
    </div>
  );
}

/* ---------- Small UI bits ---------- */
function MetricChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={cn(
        "px-3 py-1.5 rounded-lg border bg-muted/30 text-xs flex flex-col leading-tight",
        tone === "danger" && "border-red-400/60 bg-red-50 dark:bg-red-950/30"
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-sm">{value}</span>
    </div>
  );
}

function HealthBadge({ health, label }: { health: Health; label?: string }) {
  const map: Record<Health, { color: string; text: string; icon: any }> = {
    on_track: {
      color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-400/40",
      text: "On Track",
      icon: CheckCircle2,
    },
    at_risk: {
      color:
        "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-400/40",
      text: "At Risk",
      icon: AlertTriangle,
    },
    off_track: {
      color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-400/40",
      text: "Off Track",
      icon: ShieldAlert,
    },
  };
  const m = map[health];
  const Icon = m.icon;
  return (
    <div className={cn("px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2", m.color)}>
      <Icon className="h-4 w-4" />
      <div className="leading-tight">
        {label && <div className="text-[10px] opacity-75">{label}</div>}
        <div className="font-semibold">{m.text}</div>
      </div>
    </div>
  );
}

/* ---------- Charter info ---------- */
function CharterInfoCard({
  projectId,
  charter,
  profileMap,
  defaultOwner,
}: {
  projectId: string;
  charter: any;
  profileMap: Map<string, string>;
  defaultOwner: string | null;
}) {
  const upsert = useUpsertCharter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(() => ({
    business_case: charter?.business_case ?? "",
    objectives: charter?.objectives ?? "",
    in_scope: charter?.in_scope ?? "",
    out_of_scope: charter?.out_of_scope ?? "",
    success_criteria: charter?.success_criteria ?? "",
    assumptions: charter?.assumptions ?? "",
    constraints: charter?.constraints ?? "",
    budget_amount: charter?.budget_amount ?? "",
    budget_currency: charter?.budget_currency ?? "USD",
    executive_sponsor_id: charter?.executive_sponsor_id ?? "",
    project_owner_id: charter?.project_owner_id ?? defaultOwner ?? "",
  }));

  const start = () => {
    setForm({
      business_case: charter?.business_case ?? "",
      objectives: charter?.objectives ?? "",
      in_scope: charter?.in_scope ?? "",
      out_of_scope: charter?.out_of_scope ?? "",
      success_criteria: charter?.success_criteria ?? "",
      assumptions: charter?.assumptions ?? "",
      constraints: charter?.constraints ?? "",
      budget_amount: charter?.budget_amount ?? "",
      budget_currency: charter?.budget_currency ?? "USD",
      executive_sponsor_id: charter?.executive_sponsor_id ?? "",
      project_owner_id: charter?.project_owner_id ?? defaultOwner ?? "",
    });
    setEditing(true);
  };

  const save = async () => {
    await upsert.mutateAsync({
      project_id: projectId,
      ...form,
      budget_amount: form.budget_amount === "" ? null : Number(form.budget_amount),
      executive_sponsor_id: form.executive_sponsor_id || null,
      project_owner_id: form.project_owner_id || null,
    });
    setEditing(false);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Project Charter</h3>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={start}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="grid md:grid-cols-2 gap-4">
          <PersonSelect
            label="Executive Sponsor"
            value={form.executive_sponsor_id}
            onChange={(v) => setForm({ ...form, executive_sponsor_id: v })}
            profileMap={profileMap}
          />
          <PersonSelect
            label="Project Owner"
            value={form.project_owner_id}
            onChange={(v) => setForm({ ...form, project_owner_id: v })}
            profileMap={profileMap}
          />
          <Field label="Budget">
            <div className="flex gap-2">
              <Input
                type="number"
                value={form.budget_amount}
                onChange={(e) => setForm({ ...form, budget_amount: e.target.value })}
                placeholder="0"
              />
              <Input
                className="w-20"
                value={form.budget_currency}
                onChange={(e) => setForm({ ...form, budget_currency: e.target.value })}
              />
            </div>
          </Field>
          <div />
          {(
            [
              ["business_case", "Business Case"],
              ["objectives", "Objectives"],
              ["in_scope", "In Scope"],
              ["out_of_scope", "Out of Scope"],
              ["success_criteria", "Success Criteria"],
              ["assumptions", "Assumptions"],
              ["constraints", "Constraints"],
            ] as const
          ).map(([k, l]) => (
            <Field key={k} label={l} className="md:col-span-2">
              <Textarea
                rows={3}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <ReadField label="Executive Sponsor">
            {charter?.executive_sponsor_id
              ? profileMap.get(charter.executive_sponsor_id) ?? "—"
              : "—"}
          </ReadField>
          <ReadField label="Project Owner">
            {charter?.project_owner_id
              ? profileMap.get(charter.project_owner_id) ?? "—"
              : defaultOwner
              ? profileMap.get(defaultOwner) ?? "—"
              : "—"}
          </ReadField>
          <ReadField label="Budget">
            {charter?.budget_amount != null
              ? `${charter.budget_currency} ${Number(charter.budget_amount).toLocaleString()}`
              : "—"}
          </ReadField>
          <div />
          {[
            ["business_case", "Business Case"],
            ["objectives", "Objectives"],
            ["in_scope", "In Scope"],
            ["out_of_scope", "Out of Scope"],
            ["success_criteria", "Success Criteria"],
            ["assumptions", "Assumptions"],
            ["constraints", "Constraints"],
          ].map(([k, l]) => (
            <ReadField key={k} label={l} className="md:col-span-2">
              <span className="whitespace-pre-wrap">{charter?.[k] || "—"}</span>
            </ReadField>
          ))}
        </div>
      )}
    </Card>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ReadField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function PersonSelect({
  label,
  value,
  onChange,
  profileMap,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  profileMap: Map<string, string>;
}) {
  return (
    <Field label={label}>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Unassigned</SelectItem>
          {Array.from(profileMap.entries()).map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/* ---------- Stakeholders / RACI ---------- */
function StakeholdersCard({
  projectId,
  stakeholders,
  profileMap,
  profiles,
}: {
  projectId: string;
  stakeholders: LaunchStakeholder[];
  profileMap: Map<string, string>;
  profiles: any[];
}) {
  const add = useAddStakeholder();
  const del = useDeleteStakeholder();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    external_name: "",
    external_email: "",
    workstream: "General",
    raci: "R" as RACI,
    notes: "",
  });

  const grouped = useMemo(() => {
    const g = new Map<string, LaunchStakeholder[]>();
    stakeholders.forEach((s) => {
      const list = g.get(s.workstream) || [];
      list.push(s);
      g.set(s.workstream, list);
    });
    return Array.from(g.entries());
  }, [stakeholders]);

  const handleAdd = async () => {
    if (!form.user_id && !form.external_name) {
      return;
    }
    await add.mutateAsync({
      project_id: projectId,
      user_id: form.user_id || null,
      external_name: form.user_id ? null : form.external_name,
      external_email: form.user_id ? null : form.external_email || null,
      workstream: form.workstream || "General",
      raci: form.raci,
      notes: form.notes || null,
    });
    setForm({
      user_id: "",
      external_name: "",
      external_email: "",
      workstream: "General",
      raci: "R",
      notes: "",
    });
    setOpen(false);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Stakeholders (RACI)</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      {stakeholders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No stakeholders yet. Add Responsible / Accountable / Consulted / Informed per workstream.
        </p>
      ) : (
        <div className="space-y-3">
          {grouped.map(([workstream, list]) => (
            <div key={workstream}>
              <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                {workstream}
              </div>
              <div className="space-y-1.5">
                {list.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-2 rounded-md border bg-muted/20"
                  >
                    <span className={cn("px-2 py-0.5 rounded text-xs font-bold w-7 text-center", RACI_COLOR[s.raci])}>
                      {s.raci}
                    </span>
                    <span className="text-xs text-muted-foreground w-24">{RACI_LABEL[s.raci]}</span>
                    <div className="flex-1 text-sm">
                      {s.user_id
                        ? profileMap.get(s.user_id) ?? "Unknown user"
                        : s.external_name}
                      {s.external_email && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {s.external_email}
                        </span>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => del.mutate({ id: s.id, projectId })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stakeholder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Workstream">
              <Input
                value={form.workstream}
                onChange={(e) => setForm({ ...form, workstream: e.target.value })}
                placeholder="e.g. Formulation, Regulatory, Marketing"
              />
            </Field>
            <Field label="Role">
              <Select
                value={form.raci}
                onValueChange={(v) => setForm({ ...form, raci: v as RACI })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["R", "A", "C", "I"] as RACI[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r} — {RACI_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Internal team member (optional)">
              <Select
                value={form.user_id || "__none__"}
                onValueChange={(v) =>
                  setForm({ ...form, user_id: v === "__none__" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— External contact instead —</SelectItem>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {!form.user_id && (
              <>
                <Field label="External name">
                  <Input
                    value={form.external_name}
                    onChange={(e) => setForm({ ...form, external_name: e.target.value })}
                  />
                </Field>
                <Field label="External email (optional)">
                  <Input
                    type="email"
                    value={form.external_email}
                    onChange={(e) => setForm({ ...form, external_email: e.target.value })}
                  />
                </Field>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Milestones ---------- */
function MilestonesCard({
  projectId,
  milestones,
  profileMap,
  profiles,
}: {
  projectId: string;
  milestones: LaunchMilestoneFull[];
  profileMap: Map<string, string>;
  profiles: any[];
}) {
  const upsert = useUpsertMilestone();
  const signoff = useSignoffMilestone();
  const del = useDeleteMilestone();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LaunchMilestoneFull | null>(null);
  const [form, setForm] = useState<any>({
    name: "",
    date: formatET(new Date(), "yyyy-MM-dd"),
    description: "",
    owner_id: "",
    status: "pending",
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      date: formatET(new Date(), "yyyy-MM-dd"),
      description: "",
      owner_id: "",
      status: "pending",
    });
    setOpen(true);
  };
  const openEdit = (m: LaunchMilestoneFull) => {
    setEditing(m);
    setForm({
      name: m.name,
      date: m.date,
      description: m.description || "",
      owner_id: m.owner_id || "",
      status: m.status,
    });
    setOpen(true);
  };
  const save = async () => {
    if (!form.name.trim()) return;
    await upsert.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      project_id: projectId,
      name: form.name.trim(),
      date: form.date,
      description: form.description || null,
      owner_id: form.owner_id || null,
      status: form.status,
    } as any);
    setOpen(false);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Milestones</h3>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Milestone
        </Button>
      </div>
      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No milestones yet.</p>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 rounded-md border bg-muted/20"
            >
              <MilestoneStatusIcon status={m.status} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.name}</div>
                <div className="text-xs text-muted-foreground">
                  {format(parseISO(m.date), "MMM d, yyyy")}
                  {m.owner_id && (
                    <> · Owner: {profileMap.get(m.owner_id) ?? "Unknown"}</>
                  )}
                  {m.signed_off_at && (
                    <> · Signed off {format(parseISO(m.signed_off_at), "MMM d")}</>
                  )}
                </div>
              </div>
              {m.status !== "done" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => signoff.mutate({ id: m.id, projectId })}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Sign off
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => openEdit(m)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => del.mutate({ id: m.id, projectId })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit milestone" : "New milestone"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target date">
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
              <Field label="Status">
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="ready_for_signoff">Ready for sign-off</SelectItem>
                    <SelectItem value="at_risk">At risk</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <PersonSelect
              label="Owner"
              value={form.owner_id}
              onChange={(v) => setForm({ ...form, owner_id: v })}
              profileMap={new Map(profiles.map((p: any) => [p.id, p.display_name || p.email]))}
            />
            <Field label="Description">
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MilestoneStatusIcon({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === "at_risk") return <ShieldAlert className="h-5 w-5 text-red-500" />;
  if (status === "ready_for_signoff")
    return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  return <CircleDot className="h-5 w-5 text-muted-foreground" />;
}

/* ---------- Risks (3x3) ---------- */
function RisksCard({
  projectId,
  risks,
  profileMap,
  profiles,
}: {
  projectId: string;
  risks: LaunchRisk[];
  profileMap: Map<string, string>;
  profiles: any[];
}) {
  const upsert = useUpsertRisk();
  const del = useDeleteRisk();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LaunchRisk | null>(null);
  const [form, setForm] = useState<any>({
    title: "",
    description: "",
    likelihood: 2,
    impact: 2,
    status: "open",
    owner_id: "",
    mitigation: "",
    contingency: "",
    due_date: "",
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      likelihood: 2,
      impact: 2,
      status: "open",
      owner_id: "",
      mitigation: "",
      contingency: "",
      due_date: "",
    });
    setOpen(true);
  };
  const openEdit = (r: LaunchRisk) => {
    setEditing(r);
    setForm({
      title: r.title,
      description: r.description || "",
      likelihood: r.likelihood,
      impact: r.impact,
      status: r.status,
      owner_id: r.owner_id || "",
      mitigation: r.mitigation || "",
      contingency: r.contingency || "",
      due_date: r.due_date || "",
    });
    setOpen(true);
  };
  const save = async () => {
    if (!form.title.trim()) return;
    await upsert.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      project_id: projectId,
      title: form.title.trim(),
      description: form.description || null,
      likelihood: Number(form.likelihood),
      impact: Number(form.impact),
      status: form.status,
      owner_id: form.owner_id || null,
      mitigation: form.mitigation || null,
      contingency: form.contingency || null,
      due_date: form.due_date || null,
    } as any);
    setOpen(false);
  };

  // 3x3 heatmap
  const cells = useMemo(() => {
    const map: Record<string, LaunchRisk[]> = {};
    risks.forEach((r) => {
      if (r.status === "closed") return;
      const k = `${r.likelihood}-${r.impact}`;
      (map[k] = map[k] || []).push(r);
    });
    return map;
  }, [risks]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Risk Register</h3>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Risk
        </Button>
      </div>

      {/* Heatmap */}
      <div className="grid grid-cols-[80px_repeat(3,1fr)] gap-1 max-w-md text-xs">
        <div></div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="text-center font-medium text-muted-foreground">
            Impact {i}
          </div>
        ))}
        {[3, 2, 1].map((l) => (
          <>
            <div key={`l-${l}`} className="font-medium text-muted-foreground self-center">
              Likelihood {l}
            </div>
            {[1, 2, 3].map((i) => {
              const score = l * i;
              const list = cells[`${l}-${i}`] || [];
              const tone =
                score >= 6
                  ? "bg-red-200 dark:bg-red-900/60 text-red-900 dark:text-red-100"
                  : score >= 3
                  ? "bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100"
                  : "bg-green-200 dark:bg-green-900/60 text-green-900 dark:text-green-100";
              return (
                <div
                  key={`${l}-${i}`}
                  className={cn(
                    "h-12 rounded flex items-center justify-center font-semibold",
                    tone
                  )}
                >
                  {list.length || ""}
                </div>
              );
            })}
          </>
        ))}
      </div>

      {risks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No risks logged.</p>
      ) : (
        <div className="space-y-2">
          {risks.map((r) => {
            const score = r.likelihood * r.impact;
            const tone =
              score >= 6
                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                : score >= 3
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
            return (
              <div
                key={r.id}
                className="flex items-start gap-3 p-3 rounded-md border bg-muted/20"
              >
                <span className={cn("px-2 py-1 rounded text-xs font-bold w-9 text-center", tone)}>
                  {score}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-medium">{r.title}</div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {r.status}
                    </Badge>
                  </div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>
                  )}
                  {r.mitigation && (
                    <div className="text-xs mt-1">
                      <span className="text-muted-foreground">Mitigation: </span>
                      {r.mitigation}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    L:{r.likelihood} × I:{r.impact}
                    {r.owner_id && <> · {profileMap.get(r.owner_id) ?? "Unknown"}</>}
                    {r.due_date && <> · Due {format(parseISO(r.due_date), "MMM d")}</>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => del.mutate({ id: r.id, projectId })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit risk" : "New risk"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Likelihood (1-3)">
                <Select
                  value={String(form.likelihood)}
                  onValueChange={(v) => setForm({ ...form, likelihood: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Low</SelectItem>
                    <SelectItem value="2">2 — Med</SelectItem>
                    <SelectItem value="3">3 — High</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Impact (1-3)">
                <Select
                  value={String(form.impact)}
                  onValueChange={(v) => setForm({ ...form, impact: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Low</SelectItem>
                    <SelectItem value="2">2 — Med</SelectItem>
                    <SelectItem value="3">3 — High</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="mitigating">Mitigating</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <PersonSelect
              label="Owner"
              value={form.owner_id}
              onChange={(v) => setForm({ ...form, owner_id: v })}
              profileMap={new Map(profiles.map((p: any) => [p.id, p.display_name || p.email]))}
            />
            <Field label="Mitigation plan">
              <Textarea
                rows={2}
                value={form.mitigation}
                onChange={(e) => setForm({ ...form, mitigation: e.target.value })}
              />
            </Field>
            <Field label="Contingency">
              <Textarea
                rows={2}
                value={form.contingency}
                onChange={(e) => setForm({ ...form, contingency: e.target.value })}
              />
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Status snapshot capture ---------- */
function CaptureSnapshotButton({
  projectId,
  defaults,
}: {
  projectId: string;
  defaults: {
    health: Health;
    percent_complete: number;
    open_risks_count: number;
    milestones_done: number;
    milestones_total: number;
  };
}) {
  const capture = useCaptureSnapshot();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    health: defaults.health,
    percent_complete: defaults.percent_complete,
    accomplishments: "",
    next_steps: "",
    blockers: "",
  });
  const start = () => {
    setForm({
      health: defaults.health,
      percent_complete: defaults.percent_complete,
      accomplishments: "",
      next_steps: "",
      blockers: "",
    });
    setOpen(true);
  };
  const save = async () => {
    await capture.mutateAsync({
      project_id: projectId,
      health: form.health,
      percent_complete: form.percent_complete,
      accomplishments: form.accomplishments || null,
      next_steps: form.next_steps || null,
      blockers: form.blockers || null,
      open_risks_count: defaults.open_risks_count,
      milestones_done: defaults.milestones_done,
      milestones_total: defaults.milestones_total,
    });
    setOpen(false);
  };
  return (
    <>
      <Button size="sm" onClick={start}>
        <CameraIcon className="h-4 w-4 mr-1" /> Capture status
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Capture status snapshot</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Health">
                <Select
                  value={form.health}
                  onValueChange={(v) => setForm({ ...form, health: v as Health })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_track">On Track</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="off_track">Off Track</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="% complete">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.percent_complete}
                  onChange={(e) =>
                    setForm({ ...form, percent_complete: Number(e.target.value) || 0 })
                  }
                />
              </Field>
            </div>
            <Field label="Accomplishments this period">
              <Textarea
                rows={3}
                value={form.accomplishments}
                onChange={(e) => setForm({ ...form, accomplishments: e.target.value })}
              />
            </Field>
            <Field label="Next steps">
              <Textarea
                rows={3}
                value={form.next_steps}
                onChange={(e) => setForm({ ...form, next_steps: e.target.value })}
              />
            </Field>
            <Field label="Blockers / decisions needed">
              <Textarea
                rows={2}
                value={form.blockers}
                onChange={(e) => setForm({ ...form, blockers: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Capture</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SnapshotsHistory({
  snapshots,
  profileMap,
}: {
  snapshots: any[];
  profileMap: Map<string, string>;
}) {
  if (!snapshots.length) return null;
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold">Status history</h3>
      <div className="space-y-3">
        {snapshots.map((s) => (
          <div key={s.id} className="border-l-2 border-muted pl-3 pb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HealthBadge health={s.health} />
              <span>
                {format(parseISO(s.captured_at), "MMM d, yyyy h:mma")}
                {s.captured_by && <> · {profileMap.get(s.captured_by) ?? "Unknown"}</>}
              </span>
            </div>
            <div className="mt-2">
              <Progress value={s.percent_complete} className="h-1.5" />
              <div className="text-xs text-muted-foreground mt-0.5">
                {s.percent_complete}% · {s.milestones_done}/{s.milestones_total} milestones ·{" "}
                {s.open_risks_count} open risks
              </div>
            </div>
            {s.accomplishments && (
              <div className="text-sm mt-2">
                <span className="text-xs text-muted-foreground">Accomplishments: </span>
                <span className="whitespace-pre-wrap">{s.accomplishments}</span>
              </div>
            )}
            {s.next_steps && (
              <div className="text-sm mt-1">
                <span className="text-xs text-muted-foreground">Next: </span>
                <span className="whitespace-pre-wrap">{s.next_steps}</span>
              </div>
            )}
            {s.blockers && (
              <div className="text-sm mt-1 text-red-600 dark:text-red-400">
                <span className="text-xs opacity-75">Blockers: </span>
                <span className="whitespace-pre-wrap">{s.blockers}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
