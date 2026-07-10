import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Link } from "react-router-dom";
import {
  useLaunchTasks,
  useLaunchProductLines,
  LAUNCH_PHASES,
  LAUNCH_STATUSES,
} from "@/hooks/launch/useLaunch";
import { useProfiles } from "@/hooks/useProfiles";
import { format, isPast, parseISO, isWithinInterval, addDays } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  todo: "#9CA3AF",
  in_progress: "#2F6DF6",
  blocked: "#EF4444",
  done: "#10B981",
};

export default function LaunchDashboard() {
  const { data: tasks = [] } = useLaunchTasks();
  const { data: lines = [] } = useLaunchProductLines();
  const { data: profiles = [] } = useProfiles();

  const lineMap = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);
  const profileMap = useMemo(
    () => new Map(profiles.map((p: any) => [p.id, p.display_name || p.full_name || p.email])),
    [profiles]
  );

  const total = tasks.length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const blockedOrOverdue = tasks.filter(
    (t) =>
      t.status === "review" ||
      (t.due_date && t.status !== "done" && isPast(parseISO(t.due_date)))
  ).length;

  const byLine = useMemo(
    () =>
      lines.map((l) => {
        const list = tasks.filter((t) => t.product_line_id === l.id);
        const d = list.filter((t) => t.status === "done").length;
        return { line: l, total: list.length, done: d };
      }),
    [tasks, lines]
  );

  const byPhase = useMemo(
    () =>
      LAUNCH_PHASES.map((p) => {
        const list = tasks.filter((t) => t.phase === p);
        const d = list.filter((t) => t.status === "done").length;
        return { phase: p, total: list.length, done: d };
      }),
    [tasks]
  );

  const statusData = LAUNCH_STATUSES.map((s) => ({
    name: s.label,
    value: tasks.filter((t) => t.status === s.value).length,
    color: STATUS_COLORS[s.value],
  }));

  const workload = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks
      .filter((t) => t.status !== "done" && t.assignee_id)
      .forEach((t) => {
        counts[t.assignee_id!] = (counts[t.assignee_id!] || 0) + 1;
      });
    return Object.entries(counts)
      .map(([id, n]) => ({ name: profileMap.get(id) || "Unknown", count: n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [tasks, profileMap]);

  const today = new Date();
  const upcoming = tasks
    .filter(
      (t) =>
        t.status !== "done" &&
        t.due_date &&
        isWithinInterval(parseISO(t.due_date), { start: today, end: addDays(today, 14) })
    )
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const overdue = tasks.filter(
    (t) => t.status !== "done" && t.due_date && isPast(parseISO(t.due_date))
  );

  const Kpi = ({ label, value, accent }: { label: string; value: number; accent?: string }) => (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={cn("text-3xl font-bold mt-1", accent)}>{value}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Project Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Capsules, Softgels, and Gummies — launch progress overview.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total tasks" value={total} />
        <Kpi label="In progress" value={inProgress} accent="text-primary" />
        <Kpi label="Blocked / overdue" value={blockedOrOverdue} accent="text-red-600" />
        <Kpi label="Done" value={done} accent="text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress by product line</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byLine.map(({ line, total, done }) => (
              <div key={line.id}>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: line.color }}
                    />
                    {line.name}
                    {line.target_launch_date && (
                      <span className="text-xs text-muted-foreground">
                        · target {format(parseISO(line.target_launch_date), "MMM d, yyyy")}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {done}/{total}
                  </span>
                </div>
                <Progress
                  value={total ? (done / total) * 100 : 0}
                  className="h-2 mt-1"
                />
              </div>
            ))}
            {byLine.length === 0 && (
              <p className="text-sm text-muted-foreground">No product lines yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress by phase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byPhase.map(({ phase, total, done }) => (
              <div key={phase}>
                <div className="flex justify-between text-sm">
                  <span>{phase}</span>
                  <span className="text-muted-foreground">
                    {done}/{total}
                  </span>
                </div>
                <Progress value={total ? (done / total) * 100 : 0} className="h-2 mt-1" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status breakdown</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="value"
                  label
                >
                  {statusData.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workload by owner (open tasks)</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workload} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#2F6DF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overdue ({overdue.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {overdue.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing overdue. </p>
            )}
            {overdue.map((t) => {
              const line = t.product_line_id ? lineMap.get(t.product_line_id) : null;
              return (
                <Link
                  to="/launch/board"
                  key={t.id}
                  className="flex justify-between items-center border rounded-lg p-2 hover:bg-accent/30"
                >
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {line?.name} · {t.phase}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-red-600 border-red-300">
                    {format(parseISO(t.due_date!), "MMM d")}
                  </Badge>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming 14 days ({upcoming.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing due soon.</p>
            )}
            {upcoming.map((t) => {
              const line = t.product_line_id ? lineMap.get(t.product_line_id) : null;
              return (
                <Link
                  to="/launch/board"
                  key={t.id}
                  className="flex justify-between items-center border rounded-lg p-2 hover:bg-accent/30"
                >
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {line?.name} · {t.phase}
                    </div>
                  </div>
                  <Badge variant="outline">{format(parseISO(t.due_date!), "MMM d")}</Badge>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
