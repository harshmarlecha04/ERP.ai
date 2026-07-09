import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { TEAMS, BUILDINGS, LEAVE_TYPES, teamLabel } from '@/lib/scheduleConstants';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useScheduleEmployees, useCreateScheduleEmployee, useDeleteScheduleEmployee } from '@/hooks/useScheduleEmployees';
import { useBulkAssign } from '@/hooks/useEmployeeSchedule';
import { Plus, Search, X, Trash2, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { todayET } from "@/utils/dateUtils";

const parseLocal = (s: string) => {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toYmd = (d: Date) => format(d, 'yyyy-MM-dd');

const DateField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const date = parseLocal(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'PPP') : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 z-[60]"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onChange(toYmd(d))}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
}

type Picked = { kind: 'profile' | 'roster'; id: string; name: string };

export const AssignDialog = ({ open, onOpenChange, defaultDate }: Props) => {
  const { data: profiles = [] } = useTeamMembers();
  const { data: roster = [] } = useScheduleEmployees();
  const createEmployee = useCreateScheduleEmployee();
  const deleteEmployee = useDeleteScheduleEmployee();
  const assign = useBulkAssign();

  const today = (defaultDate || todayET());

  const [selected, setSelected] = useState<Picked[]>([]);
  const [search, setSearch] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTeam, setNewTeam] = useState<string>('manufacturing');

  const [teams, setTeams] = useState<string[]>(['manufacturing']);
  const [building, setBuilding] = useState<string>('17_west');
  const [mode, setMode] = useState<'shift' | 'leave'>('shift');
  const [fullDay, setFullDay] = useState(true);
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [leaveType, setLeaveType] = useState<string>('pto');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelected([]); setSearch(''); setShowAddNew(false); setNewName(''); setNewTeam('manufacturing');
    setTeams(['manufacturing']); setBuilding('17_west'); setMode('shift'); setFullDay(true);
    setStartTime('07:00'); setEndTime('15:00'); setLeaveType('pto');
    setFrom(today); setTo(today); setNotes('');
  }, [open, today]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items: Picked[] = [
      ...profiles.map(p => ({ kind: 'profile' as const, id: p.id, name: p.display_name || p.email })),
      ...roster.map(r => ({ kind: 'roster' as const, id: r.id, name: r.full_name })),
    ];
    const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q)) : items;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, roster, search]);

  const isSelected = (c: Picked) => selected.some(s => s.kind === c.kind && s.id === c.id);
  const toggle = (c: Picked) => {
    setSelected(prev => isSelected(c)
      ? prev.filter(s => !(s.kind === c.kind && s.id === c.id))
      : [...prev, c]);
  };

  const toggleTeam = (t: string) => {
    setTeams(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleAddNew = async () => {
    if (!newName.trim()) return;
    const created = await createEmployee.mutateAsync({ full_name: newName.trim(), default_team: newTeam });
    setSelected(prev => [...prev, { kind: 'roster', id: created.id, name: created.full_name }]);
    setNewName(''); setShowAddNew(false);
  };

  const handleSubmit = async () => {
    await assign.mutateAsync({
      employees: selected.map(s => ({ kind: s.kind, id: s.id })),
      teams,
      building: mode === 'shift' ? building : null,
      from, to,
      mode,
      fullDay,
      startTime: fullDay ? null : startTime,
      endTime: fullDay ? null : endTime,
      leaveType: mode === 'leave' ? leaveType : null,
      notes,
    });
    onOpenChange(false);
  };

  const canSubmit = selected.length > 0 && teams.length > 0 && from && to && !assign.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-none w-[98vw] sm:w-[95vw] max-h-[90vh] overflow-y-auto" onFocusOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Assign employees</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Employees */}
          <div className="space-y-3">
            <div>
              <Label>Employees</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search employees…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map(s => (
                  <Badge key={`${s.kind}-${s.id}`} variant="secondary" className="gap-1">
                    {s.name}
                    <button onClick={() => toggle(s)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}

            <ScrollArea className="h-56 border rounded-md">
              <div className="p-1">
                {candidates.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-3 text-center">No matches.</div>
                ) : candidates.map(c => (
                  <div
                    key={`${c.kind}-${c.id}`}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent group",
                      isSelected(c) && "bg-accent"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c)}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      <Checkbox checked={isSelected(c)} className="pointer-events-none" />
                      <span className="flex-1">{c.name}</span>
                    </button>
                    {c.kind === 'roster' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove ${c.name} from the roster?`)) {
                            deleteEmployee.mutate(c.id);
                            setSelected(prev => prev.filter(s => !(s.kind === 'roster' && s.id === c.id)));
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                        title="Remove employee"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {showAddNew ? (
              <div className="border rounded-md p-3 space-y-2">
                <div className="text-xs font-medium">Add new employee</div>
                <Input placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Select value={newTeam} onValueChange={setNewTeam}>
                  <SelectTrigger><SelectValue placeholder="Default team" /></SelectTrigger>
                  <SelectContent>
                    {TEAMS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setShowAddNew(false); setNewName(''); }}>Cancel</Button>
                  <Button size="sm" onClick={handleAddNew} disabled={!newName.trim() || createEmployee.isPending}>Add</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowAddNew(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add new employee
              </Button>
            )}
          </div>

          {/* Assignment */}
          <div className="space-y-3">
            <div>
              <Label>Teams (one row created per team)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {TEAMS.map(t => {
                  const on = teams.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      onClick={() => toggleTeam(t.value)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs border transition",
                        on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                      )}
                    >
                      <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", t.color)} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="font-medium text-sm">Leave / PTO</div>
                <div className="text-xs text-muted-foreground">Toggle for furlough, PTO, sick, unpaid</div>
              </div>
              <Switch checked={mode === 'leave'} onCheckedChange={(v) => setMode(v ? 'leave' : 'shift')} />
            </div>

            {mode === 'shift' ? (
              <>
                <div>
                  <Label>Building</Label>
                  <Select value={building} onValueChange={setBuilding}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUILDINGS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between border rounded-md p-3">
                  <Label className="cursor-pointer">Full day</Label>
                  <Switch checked={fullDay} onCheckedChange={setFullDay} />
                </div>
                {!fullDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Start</Label>
                      <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div>
                <Label>Leave type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From</Label>
                <DateField value={from} onChange={setFrom} />
              </div>
              <div>
                <Label>To</Label>
                <DateField value={to} onChange={setTo} />
              </div>
            </div>

            <div>
              <Label>Comments</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes applied to every entry" />
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground border-t pt-3">
          {selected.length > 0 && teams.length > 0 && from && to
            ? `Will create ~${selected.length * teams.length * (Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1) | 0)} entries (${selected.length} employee${selected.length === 1 ? '' : 's'} × ${teams.length} team${teams.length === 1 ? '' : 's'} × dates).`
            : 'Pick employees, at least one team, and a date range.'}
          {teams.length > 1 && (
            <div className="mt-1">Teams: {teams.map(teamLabel).join(', ')}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
