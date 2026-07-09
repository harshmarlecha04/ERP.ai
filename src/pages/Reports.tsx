import { useState } from "react";
import { Sparkles, Play, Download, Table as TableIcon, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReportResult {
  plan: any;
  rows: Record<string, any>[];
  rowCount: number;
}

const EXAMPLES = [
  "Top 10 open customer orders by due date",
  "Purchase orders created in the last 30 days, grouped by status",
  "Formulas with active status",
  "Production scheduled this week",
];

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export default function Reports() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const run = async (q: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("nl-reports", {
        body: { prompt: q },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as ReportResult);
    } catch (e: any) {
      setError(e?.message ?? "Failed to run report");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.rows.length) return;
    const csv = toCsv(result.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chart = result?.plan?.chart;
  const cols = result?.rows[0] ? Object.keys(result.rows[0]) : [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Ask a question in plain English. Financial fields are gated by your access level.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ask a question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Open customer orders due in the next 14 days"
            rows={3}
            maxLength={1000}
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <Badge
                  key={ex}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setPrompt(ex)}
                >
                  {ex}
                </Badge>
              ))}
            </div>
            <Button onClick={() => run(prompt)} disabled={!prompt.trim() || loading} className="gap-2">
              <Play className="h-4 w-4" />
              {loading ? "Running…" : "Run report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="p-6 space-y-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-32" />
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {result && !loading && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">
                  {result.plan?.title ?? "Result"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({result.rowCount} row{result.rowCount === 1 ? "" : "s"})
                  </span>
                </CardTitle>
                {result.plan?.summary && (
                  <p className="text-xs text-muted-foreground mt-1">{result.plan.summary}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!result.rows.length}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {chart?.type && chart.type !== "none" && chart.x && chart.y && result.rows.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <BarChart3 className="h-3.5 w-3.5" /> Chart
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    {chart.type === "bar" ? (
                      <BarChart data={result.rows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey={chart.x} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip />
                        <Bar dataKey={chart.y} fill="hsl(var(--primary))" />
                      </BarChart>
                    ) : chart.type === "line" ? (
                      <LineChart data={result.rows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey={chart.x} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip />
                        <Line type="monotone" dataKey={chart.y} stroke="hsl(var(--primary))" />
                      </LineChart>
                    ) : (
                      <PieChart>
                        <Pie data={result.rows} dataKey={chart.y} nameKey={chart.x} outerRadius={80} label>
                          {result.rows.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <TableIcon className="h-3.5 w-3.5" /> Data
              </div>
              {result.rows.length === 0 ? (
                <EmptyState title="No rows returned" description="Try a broader query." />
              ) : (
                <div className="border rounded-md max-h-[480px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {cols.map((c) => (
                          <TableHead key={c}>{c}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.map((r, i) => (
                        <TableRow key={i}>
                          {cols.map((c) => (
                            <TableCell key={c} className="text-xs">
                              {r[c] == null ? "—" : typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
