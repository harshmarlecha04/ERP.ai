import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, List, UserMinus, UserPlus } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, parseISO, isSameDay } from 'date-fns';
import { useScheduleEntries, type ScheduleEntry } from '@/hooks/useEmployeeSchedule';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useUserRoles } from '@/hooks/useUserRoles';
import { TEAMS, BUILDINGS, LEAVE_TYPES, buildingLabel, buildingTint, teamLabel, leaveLabel, leaveTint } from '@/lib/scheduleConstants';
import { ShiftEditorDialog } from '@/components/schedule/ShiftEditorDialog';
import { FurloughDialog } from '@/components/schedule/FurloughDialog';
import { AssignDialog } from '@/components/schedule/AssignDialog';
import { cn } from '@/lib/utils';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

export default function Schedule() {
  const { currentUserRoles } = useUserRoles();
  const canEdit = currentUserRoles?.role === 'admin' || currentUserRoles?.role === 'hr_manager';

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitial, setEditorInitial] = useState<Partial<ScheduleEntry> | null>(null);
  const [editorDefaults, setEditorDefaults] = useState<{ date?: string; employee_id?: string }>({});
  const [furloughOpen, setFurloughOpen] = useState(false);
  const [furloughEmployee, setFurloughEmployee] = useState<string | undefined>();
  const [assignOpen, setAssignOpen] = useState(false);

  // fetch a 6-week window so list & calendar share cache
  const rangeStart = weekStart;
  const rangeEnd = addDays(weekStart, 41);
  const { data: entries = [] } = useScheduleEntries(fmt(rangeStart), fmt(rangeEnd));
  const { data: members = [] } = useTeamMembers();

  const memberMap = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), [members]);

  const filteredMembers = useMemo(() => {
    const q = employeeFilter.trim().toLowerCase();
    return members.filter(m =>
      !q || (m.display_name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q)
    );
  }, [members, employeeFilter]);

  const filteredEntries = useMemo(() => entries.filter(e => {
    if (teamFilter !== 'all' && e.team !== teamFilter) return false;
    if (buildingFilter !== 'all' && e.building !== buildingFilter) return false;
    return true;
  }), [entries, teamFilter, buildingFilter]);

  const openNew = (date?: string, employee_id?: string) => {
    if (!canEdit) return;
    setEditorInitial(null);
    setEditorDefaults({ date, employee_id });
    setEditorOpen(true);
  };

  const openEdit = (entry: ScheduleEntry) => {
    if (!canEdit) return;
    setEditorInitial(entry);
    setEditorDefaults({});
    setEditorOpen(true);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Employee Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan teams across buildings, track shifts and leave.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setFurloughEmployee(undefined); setFurloughOpen(true); }}>
              <UserMinus className="h-4 w-4 mr-2" /> Add leave
            </Button>
            <Button variant="outline" onClick={() => openNew(fmt(new Date()))}>
              <Plus className="h-4 w-4 mr-2" /> New shift
            </Button>
            <Button onClick={() => setAssignOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Assign
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[120px]" />
          <div className="min-w-[160px]">
            <label className="text-xs text-muted-foreground">Team</label>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {TEAMS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs text-muted-foreground">Building</label>
            <Select value={buildingFilter} onValueChange={setBuildingFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All buildings</SelectItem>
                {BUILDINGS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[180px] text-center">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </div>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Today
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar"><CalendarDays className="h-4 w-4 mr-2" /> Calendar</TabsTrigger>
          <TabsTrigger value="list"><List className="h-4 w-4 mr-2" /> List</TabsTrigger>
        </TabsList>

        {/* ============ CALENDAR ============ */}
        <TabsContent value="calendar">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Header row */}
                <div className="grid grid-cols-[160px_repeat(7,minmax(0,1fr))] border-b bg-muted/50">
                  <div className="p-3 text-xs font-semibold text-muted-foreground">Team</div>
                  {weekDays.map(d => (
                    <div key={d.toISOString()} className={cn(
                      "p-3 text-xs font-semibold text-center border-l",
                      isSameDay(d, new Date()) && "bg-primary/10 text-primary"
                    )}>
                      <div>{format(d, 'EEE')}</div>
                      <div className="text-sm">{format(d, 'MMM d')}</div>
                    </div>
                  ))}
                </div>
                {/* Rows: one per team */}
                {TEAMS.filter(t => teamFilter === 'all' || teamFilter === t.value).map(team => (
                  <div key={team.value} className="grid grid-cols-[160px_repeat(7,minmax(0,1fr))] border-b hover:bg-muted/20">
                    <div className="p-3 text-sm flex items-center gap-2">
                      <span className={cn("inline-block w-2.5 h-2.5 rounded-full", team.color)} />
                      <span className="font-medium">{team.label}</span>
                    </div>
                    {weekDays.map(d => {
                      const dateStr = fmt(d);
                      const cellEntries = filteredEntries.filter(e =>
                        e.date === dateStr && e.entry_type === 'shift' && e.team === team.value
                      );
                      // group by building+time
                      const groups = new Map<string, { entry: ScheduleEntry; count: number; ids: string[] }>();
                      for (const e of cellEntries) {
                        const key = `${e.building}|${e.start_time || ''}|${e.end_time || ''}`;
                        const g = groups.get(key);
                        if (g) { g.count++; g.ids.push(e.id); }
                        else groups.set(key, { entry: e, count: 1, ids: [e.id] });
                      }
                      return (
                        <div
                          key={dateStr}
                          className={cn(
                            "border-l min-h-[80px] p-1.5 space-y-1",
                            canEdit && "cursor-pointer hover:bg-accent/30"
                          )}
                          onClick={(ev) => {
                            if (ev.target === ev.currentTarget && canEdit) {
                              setEditorInitial(null);
                              setEditorDefaults({ date: dateStr });
                              setEditorOpen(true);
                            }
                          }}
                        >
                          {Array.from(groups.values()).map((g, i) => (
                            <button
                              key={i}
                              onClick={() => openEdit(g.entry)}
                              className={cn(
                                "w-full text-left text-xs rounded-md border px-2 py-1 leading-tight",
                                buildingTint(g.entry.building)
                              )}
                            >
                              <div className="font-medium flex items-center justify-between gap-2">
                                <span>{buildingLabel(g.entry.building)}</span>
                                {g.count > 1 && <span className="opacity-70">×{g.count}</span>}
                              </div>
                              {g.entry.start_time && (
                                <div className="opacity-80">
                                  {g.entry.start_time.slice(0,5)}–{g.entry.end_time?.slice(0,5)}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3 mt-3 text-xs">
            {BUILDINGS.map(b => (
              <div key={b.value} className="flex items-center gap-1.5">
                <span className={cn("inline-block w-3 h-3 rounded", b.color)} /> {b.label}
              </div>
            ))}
            {LEAVE_TYPES.map(l => (
              <div key={l.value} className="flex items-center gap-1.5">
                <span className={cn("inline-block w-3 h-3 rounded border", l.tint)} /> {l.label}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ============ LIST ============ */}
        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No entries in this range.</TableCell></TableRow>
                  ) : filteredEntries
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date) || (a.team || '').localeCompare(b.team || ''))
                    .map(e => (
                      <TableRow key={e.id} className={canEdit ? "cursor-pointer" : ""} onClick={() => openEdit(e)}>
                        <TableCell className="font-medium">{format(parseISO(e.date), 'EEE MMM d')}</TableCell>
                        <TableCell>{teamLabel(e.team) || '—'}</TableCell>
                        <TableCell>{buildingLabel(e.building) || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {e.start_time ? `${e.start_time.slice(0,5)}–${e.end_time?.slice(0,5)}` : (e.entry_type === 'shift' ? 'Full day' : '—')}
                        </TableCell>
                        <TableCell>
                          {e.entry_type === 'shift'
                            ? <Badge variant="secondary">Shift</Badge>
                            : <Badge className={leaveTint(e.leave_type)}>{leaveLabel(e.leave_type)}</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{e.notes || ''}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ShiftEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editorInitial}
        defaultDate={editorDefaults.date}
        defaultEmployeeId={editorDefaults.employee_id}
      />
      <FurloughDialog
        open={furloughOpen}
        onOpenChange={setFurloughOpen}
        defaultEmployeeId={furloughEmployee}
      />
      <AssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
    </div>
  );
}
