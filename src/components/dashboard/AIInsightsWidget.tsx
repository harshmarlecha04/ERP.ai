import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Insight = {
  title: string;
  severity: "info" | "warning" | "critical";
  category: string;
  detail: string;
  recommendation: string;
};

type InsightsResponse = {
  headline: string;
  risk_level: "green" | "yellow" | "red";
  insights: Insight[];
  summary?: string;
  snapshot?: any;
  error?: string;
};

async function fetchInsights(mode: "insights" | "summary"): Promise<InsightsResponse> {
  const { data, error } = await supabase.functions.invoke("ai-operational-insights", {
    body: { mode },
  });
  if (error) throw error;
  return data;
}

const sevIcon = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const sevColor = {
  critical: "text-destructive",
  warning: "text-amber-500",
  info: "text-blue-500",
} as const;

const riskColor = {
  green: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
  yellow: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  red: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
} as const;

export function AIInsightsWidget() {
  const [mode, setMode] = useState<"insights" | "summary">("insights");

  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["ai-insights", mode],
    queryFn: () => fetchInsights(mode),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">AI Operational Insights</CardTitle>
          {data?.risk_level && (
            <Badge variant="outline" className={cn("ml-2 capitalize", riskColor[data.risk_level])}>
              {data.risk_level}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="summary">Daily Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-3">
            {isFetching && !data ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : error ? (
              <div className="text-sm text-destructive">
                {(error as any)?.message || "Failed to load insights"}
              </div>
            ) : (
              <>
                {data?.headline && (
                  <p className="text-sm font-medium text-muted-foreground border-l-2 border-primary pl-3">
                    {data.headline}
                  </p>
                )}
                {(data?.insights || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">All clear. No issues detected.</p>
                ) : (
                  data!.insights.map((ins, i) => {
                    const Icon = sevIcon[ins.severity] || Info;
                    return (
                      <div key={i} className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-start gap-2">
                          <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", sevColor[ins.severity])} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{ins.title}</span>
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {ins.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{ins.detail}</p>
                            <p className="text-xs mt-1">
                              <span className="font-medium">→ </span>
                              {ins.recommendation}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="summary">
            {isFetching && !data?.summary ? (
              <>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6 mb-2" />
                <Skeleton className="h-4 w-4/6" />
              </>
            ) : data?.summary ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{data.summary}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No summary available.</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
