import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { useLaunchProductLines, LAUNCH_PHASES, TaskFilters } from "@/hooks/launch/useLaunch";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
}

export function LaunchFilterBar({ filters, onChange }: Props) {
  const { data: lines = [] } = useLaunchProductLines();
  const { data: profiles = [] } = useProfiles();
  const { user } = useAuth();
  const [search, setSearch] = useState(filters.search || "");

  const setFilter = (patch: Partial<TaskFilters>) =>
    onChange({ ...filters, ...patch });

  const hasActive =
    !!filters.productLineId ||
    !!filters.phase ||
    !!filters.assigneeId ||
    !!filters.mine ||
    !!filters.search;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks…"
          className="pl-8 w-64"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setFilter({ search: e.target.value || undefined });
          }}
        />
      </div>

      <Select
        value={filters.productLineId || "all"}
        onValueChange={(v) =>
          setFilter({ productLineId: v === "all" ? undefined : v })
        }
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Product line" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All lines</SelectItem>
          {lines.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.phase || "all"}
        onValueChange={(v) =>
          setFilter({ phase: v === "all" ? undefined : (v as any) })
        }
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Phase" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All phases</SelectItem>
          {LAUNCH_PHASES.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.assigneeId || "all"}
        onValueChange={(v) =>
          setFilter({ assigneeId: v === "all" ? undefined : v, mine: false })
        }
        disabled={!!filters.mine}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All assignees</SelectItem>
          {profiles.map((p: any) => (
            <SelectItem key={p.id} value={p.id}>
              {p.display_name || p.full_name || p.email || "Unknown"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant={filters.mine ? "default" : "outline"}
        onClick={() =>
          setFilter({ mine: !filters.mine, assigneeId: undefined })
        }
        disabled={!user}
      >
        My tasks
      </Button>

      {hasActive && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSearch("");
            onChange({});
          }}
        >
          <X className="h-4 w-4 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}
