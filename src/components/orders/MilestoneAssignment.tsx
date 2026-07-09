import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, X, Package } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatET } from "@/utils/dateUtils";

export interface MilestoneData {
  target_bottles: number;
  target_date: string;
  notes?: string;
}

export interface LineItemMilestones {
  lineItemIndex: number;
  milestones: MilestoneData[];
}

interface MilestoneAssignmentProps {
  productLines: Array<{
    line_number: string;
    formula_code?: string;
    formula_name?: string;
    bottles_ordered: number;
  }>;
  milestonesByLine: LineItemMilestones[];
  onMilestonesChange: (milestones: LineItemMilestones[]) => void;
}

export const MilestoneAssignment = ({
  productLines,
  milestonesByLine,
  onMilestonesChange,
}: MilestoneAssignmentProps) => {
  const handleAddMilestone = (lineIndex: number) => {
    const updated = [...milestonesByLine];
    const lineEntry = updated.find(m => m.lineItemIndex === lineIndex);
    
    if (lineEntry) {
      lineEntry.milestones.push({
        target_bottles: 0,
        target_date: formatET(new Date(), 'yyyy-MM-dd'),
      });
    } else {
      updated.push({
        lineItemIndex: lineIndex,
        milestones: [{
          target_bottles: 0,
          target_date: formatET(new Date(), 'yyyy-MM-dd'),
        }],
      });
    }
    
    onMilestonesChange(updated);
  };

  const handleRemoveMilestone = (lineIndex: number, milestoneIndex: number) => {
    const updated = milestonesByLine.map(line => {
      if (line.lineItemIndex === lineIndex) {
        return {
          ...line,
          milestones: line.milestones.filter((_, i) => i !== milestoneIndex),
        };
      }
      return line;
    }).filter(line => line.milestones.length > 0);
    
    onMilestonesChange(updated);
  };

  const handleMilestoneChange = (
    lineIndex: number,
    milestoneIndex: number,
    field: keyof MilestoneData,
    value: any
  ) => {
    const updated = milestonesByLine.map(line => {
      if (line.lineItemIndex === lineIndex) {
        return {
          ...line,
          milestones: line.milestones.map((m, i) => 
            i === milestoneIndex ? { ...m, [field]: value } : m
          ),
        };
      }
      return line;
    });
    
    onMilestonesChange(updated);
  };

  const getMilestonesForLine = (lineIndex: number) => {
    return milestonesByLine.find(m => m.lineItemIndex === lineIndex)?.milestones || [];
  };

  const getTotalAllocatedBottles = (lineIndex: number) => {
    return getMilestonesForLine(lineIndex).reduce((sum, m) => sum + m.target_bottles, 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Assign Delivery Deadlines</h3>
        <p className="text-sm text-muted-foreground">
          Set multiple delivery milestones for each product line. This helps track partial shipments and staggered deliveries.
        </p>
      </div>

      {productLines.map((line, lineIndex) => {
        const milestones = getMilestonesForLine(lineIndex);
        const allocated = getTotalAllocatedBottles(lineIndex);
        const remaining = line.bottles_ordered - allocated;

        return (
          <Card key={lineIndex} className="p-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium">
                      Line #{line.line_number} - {line.formula_code}
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {line.formula_name} • {line.bottles_ordered.toLocaleString()} bottles total
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={remaining === 0 ? 'default' : 'secondary'}>
                    {allocated.toLocaleString()} / {line.bottles_ordered.toLocaleString()}
                  </Badge>
                  {remaining > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {remaining.toLocaleString()} remaining
                    </p>
                  )}
                </div>
              </div>

              {milestones.length > 0 && (
                <div className="space-y-3">
                  {milestones.map((milestone, mIndex) => (
                    <div key={mIndex} className="border rounded-md p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          Milestone {mIndex + 1}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMilestone(lineIndex, mIndex)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Bottles</Label>
                          <Input
                            type="number"
                            value={milestone.target_bottles || ''}
                            onChange={(e) =>
                              handleMilestoneChange(
                                lineIndex,
                                mIndex,
                                'target_bottles',
                                parseInt(e.target.value) || 0
                              )
                            }
                            max={line.bottles_ordered}
                            min={0}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Target Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !milestone.target_date && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                {milestone.target_date
                                  ? formatET(milestone.target_date, "MMM d, yyyy")
                                  : "Pick date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={new Date(milestone.target_date)}
                                onSelect={(date) =>
                                  date && handleMilestoneChange(
                                    lineIndex,
                                    mIndex,
                                    'target_date',
                                    format(date, 'yyyy-MM-dd')
                                  )
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddMilestone(lineIndex)}
                disabled={remaining <= 0}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Milestone {milestones.length > 0 ? `(${remaining.toLocaleString()} bottles left)` : ''}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};