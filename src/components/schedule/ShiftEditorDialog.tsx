import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TEAMS, BUILDINGS, LEAVE_TYPES } from '@/lib/scheduleConstants';
import { useUpsertScheduleEntry, useDeleteScheduleEntry, type ScheduleEntry } from '@/hooks/useEmployeeSchedule';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { Trash2 } from 'lucide-react';
import { todayET } from "@/utils/dateUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<ScheduleEntry> | null;
  defaultDate?: string;
  defaultEmployeeId?: string;
}

export const ShiftEditorDialog = ({ open, onOpenChange, initial, defaultDate }: Props) => {
  const upsert = useUpsertScheduleEntry();
  const remove = useDeleteScheduleEntry();

  const [date, setDate] = useState('');
  const [isLeave, setIsLeave] = useState(false);
  const [team, setTeam] = useState<string>('manufacturing');
  const [building, setBuilding] = useState<string>('17_west');
  const [fullDay, setFullDay] = useState(true);
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [leaveType, setLeaveType] = useState<string>('pto');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(initial?.date || defaultDate || todayET());
    setIsLeave(initial?.entry_type === 'leave');
    setTeam(initial?.team || 'manufacturing');
    setBuilding(initial?.building || '17_west');
    setFullDay(!initial?.start_time);
    setStartTime(initial?.start_time?.slice(0, 5) || '07:00');
    setEndTime(initial?.end_time?.slice(0, 5) || '15:00');
    setLeaveType(initial?.leave_type || 'pto');
    setNotes(initial?.notes || '');
  }, [open, initial, defaultDate]);

  const handleSave = async () => {
    if (!date) return;
    const payload: any = {
      id: initial?.id,
      employee_id: initial?.employee_id ?? null,
      date,
      entry_type: isLeave ? 'leave' : 'shift',
      notes: notes || null,
    };
    if (isLeave) {
      payload.leave_type = leaveType;
      payload.team = team;
      payload.building = null;
      payload.start_time = null;
      payload.end_time = null;
    } else {
      payload.team = team;
      payload.building = building;
      payload.leave_type = null;
      payload.start_time = fullDay ? null : startTime;
      payload.end_time = fullDay ? null : endTime;
    }
    await upsert.mutateAsync(payload);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!initial?.id) return;
    await remove.mutateAsync(initial.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onFocusOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Edit entry' : 'New entry'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Team</Label>
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEAMS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between border rounded-md p-3">
            <div>
              <div className="font-medium text-sm">Mark as leave</div>
              <div className="text-xs text-muted-foreground">Furlough, PTO, Sick, or Unpaid</div>
            </div>
            <Switch checked={isLeave} onCheckedChange={setIsLeave} />
          </div>

          {isLeave ? (
            <div>
              <Label>Leave type</Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
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
          )}

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {initial?.id && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!date || upsert.isPending}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
