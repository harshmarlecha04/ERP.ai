import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, FlaskConical, ArrowLeft } from "lucide-react";
import { SupplementFactsForm } from "@/components/tools/supplement-facts/SupplementFactsForm";

interface Project { id: string; project_name: string; customer_name: string | null; project_number: string | null; }
interface Version { id: string; version_number: string; rd_project_id: string; }


export default function SupplementFactsTool() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialVersion = searchParams.get("version_id") ?? "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [versionId, setVersionId] = useState<string>(initialVersion);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("rd_projects")
        .select("id, project_name, customer_name, project_number")
        .order("created_at", { ascending: false });
      setProjects(data || []);
      // If initial version, load its project
      if (initialVersion) {
        const { data: v } = await supabase
          .from("rd_project_versions")
          .select("id, version_number, rd_project_id")
          .eq("id", initialVersion)
          .maybeSingle();
        if (v) setProjectId(v.rd_project_id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!projectId) { setVersions([]); return; }
    (async () => {
      const { data } = await supabase
        .from("rd_project_versions")
        .select("id, version_number, rd_project_id")
        .eq("rd_project_id", projectId)
        .order("created_at", { ascending: false });
      setVersions(data || []);
    })();
  }, [projectId]);

  const selectedProject = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <FlaskConical className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Supplement Facts Creator</h1>
          <p className="text-sm text-muted-foreground">Generate an FDA-style Supplement Facts panel from an R&amp;D version.</p>
        </div>
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select R&amp;D Version</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Project</label>
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setVersionId(""); }} disabled={loading}>
              <SelectTrigger><SelectValue placeholder={loading ? "Loading…" : "Choose a project"} /></SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_number ? `${p.project_number} — ` : ""}{p.project_name}
                    {p.customer_name ? ` (${p.customer_name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Version</label>
            <Select value={versionId} onValueChange={(v) => { setVersionId(v); setSearchParams({ version_id: v }); }} disabled={!projectId}>
              <SelectTrigger><SelectValue placeholder={projectId ? "Choose a version" : "Select project first"} /></SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.version_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}

      {versionId && (
        <SupplementFactsForm
          key={versionId}
          versionId={versionId}
          onClose={() => {
            setVersionId("");
            const next = new URLSearchParams(searchParams);
            next.delete("version_id");
            setSearchParams(next);
          }}
        />
      )}

    </div>
  );
}
