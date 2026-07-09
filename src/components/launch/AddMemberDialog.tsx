import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfiles } from "@/hooks/useProfiles";
import { useProjectMembers, useAddProjectMember, useRemoveProjectMember } from "@/hooks/launch/useLaunch";
import { X, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
}

export function AddMemberDialog({ open, onOpenChange, projectId }: Props) {
  const { data: profiles = [] } = useProfiles();
  const { data: members = [] } = useProjectMembers(projectId);
  const add = useAddProjectMember();
  const remove = useRemoveProjectMember();
  const [search, setSearch] = useState("");

  const memberIds = new Set(members.map((m) => m.user_id));
  const filtered = profiles.filter((p: any) => {
    const name = (p.display_name || p.full_name || p.email || "").toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Project members</DialogTitle>
        </DialogHeader>

        {members.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assigned ({members.length})</div>
            {members.map((m) => {
              const p = profiles.find((x: any) => x.id === m.user_id) as any;
              const name = p?.display_name || p?.full_name || p?.email || m.user_id;
              return (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                  <span className="text-sm truncate">{name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => remove.mutate({ id: m.id, projectId })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-1.5 pt-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Add people</div>
          <Input placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {filtered.map((p: any) => {
              const name = p.display_name || p.full_name || p.email;
              const already = memberIds.has(p.id);
              return (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40">
                  <span className="text-sm truncate">{name}</span>
                  <Button
                    size="sm"
                    variant={already ? "ghost" : "outline"}
                    disabled={already}
                    onClick={() => add.mutate({ projectId, userId: p.id })}
                  >
                    {already ? "Added" : <><Plus className="h-3 w-3 mr-1" /> Add</>}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
