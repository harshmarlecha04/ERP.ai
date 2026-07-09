export const TEAMS = [
  { value: 'manufacturing', label: 'Manufacturing', color: 'bg-blue-500' },
  { value: 'coating', label: 'Coating', color: 'bg-purple-500' },
  { value: 'packaging', label: 'Packaging', color: 'bg-amber-500' },
  { value: 'qa', label: 'QA', color: 'bg-emerald-500' },
] as const;

export const BUILDINGS = [
  { value: '17_west', label: '17 West', color: 'bg-indigo-500', tint: 'bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-700' },
  { value: '282_ridgedale', label: '282 Ridgedale', color: 'bg-teal-500', tint: 'bg-teal-50 border-teal-300 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-700' },
] as const;

export const LEAVE_TYPES = [
  { value: 'furlough', label: 'Furlough', tint: 'bg-slate-200 text-slate-800 border-slate-400 dark:bg-slate-700 dark:text-slate-100' },
  { value: 'pto', label: 'PTO', tint: 'bg-green-200 text-green-900 border-green-400 dark:bg-green-900/50 dark:text-green-100' },
  { value: 'sick', label: 'Sick', tint: 'bg-amber-200 text-amber-900 border-amber-400 dark:bg-amber-900/50 dark:text-amber-100' },
  { value: 'unpaid', label: 'Unpaid', tint: 'bg-rose-200 text-rose-900 border-rose-400 dark:bg-rose-900/50 dark:text-rose-100' },
] as const;

export type TeamValue = typeof TEAMS[number]['value'];
export type BuildingValue = typeof BUILDINGS[number]['value'];
export type LeaveTypeValue = typeof LEAVE_TYPES[number]['value'];
export type EntryType = 'shift' | 'leave';

export const teamLabel = (v?: string | null) => TEAMS.find(t => t.value === v)?.label ?? '';
export const buildingLabel = (v?: string | null) => BUILDINGS.find(b => b.value === v)?.label ?? '';
export const buildingTint = (v?: string | null) => BUILDINGS.find(b => b.value === v)?.tint ?? '';
export const leaveLabel = (v?: string | null) => LEAVE_TYPES.find(l => l.value === v)?.label ?? '';
export const leaveTint = (v?: string | null) => LEAVE_TYPES.find(l => l.value === v)?.tint ?? '';
