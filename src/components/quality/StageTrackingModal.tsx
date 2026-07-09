import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useBatchStageTracking } from '@/hooks/useBatchStageTracking';
import { Clock, Play, Square, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatDistanceET, formatET } from "@/utils/dateUtils";

interface StageTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleItemId: string;
  formulaCode: string;
  formulaName: string;
}

const PRODUCTION_STAGES = [
  'Production Completed',
  'Drying',
  'Coating',
  'Packed',
  'QC/Testing',
];

export const StageTrackingModal: React.FC<StageTrackingModalProps> = ({
  isOpen,
  onClose,
  scheduleItemId,
  formulaCode,
  formulaName,
}) => {
  const [selectedStage, setSelectedStage] = useState('');
  const [notes, setNotes] = useState('');
  const [cornStarchKg, setCornStarchKg] = useState('');
  const [qualityPassed, setQualityPassed] = useState(true);
  const [hasStickingIssue, setHasStickingIssue] = useState(false);
  const [exitingStageId, setExitingStageId] = useState<string | null>(null);

  const { stageRecords, loading, enterStage, exitStage } = useBatchStageTracking(scheduleItemId);

  const activeStages = stageRecords.filter(r => !r.exited_at);
  const completedStages = stageRecords.filter(r => r.exited_at);

  const handleEnterStage = async () => {
    if (!selectedStage) return;

    const result = await enterStage(selectedStage, notes);
    if (result?.success) {
      setSelectedStage('');
      setNotes('');
    }
  };

  const handleExitStage = async () => {
    if (!exitingStageId) return;

    const result = await exitStage(
      exitingStageId,
      cornStarchKg ? parseFloat(cornStarchKg) : undefined,
      qualityPassed,
      hasStickingIssue,
      notes
    );

    if (result?.success) {
      setExitingStageId(null);
      setCornStarchKg('');
      setNotes('');
      setQualityPassed(true);
      setHasStickingIssue(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stage Tracking - {formulaCode}</DialogTitle>
          <p className="text-sm text-muted-foreground">{formulaName}</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Active Stages */}
          {activeStages.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                Active Stages
              </h3>
              <div className="space-y-2">
                {activeStages.map(stage => (
                  <div
                    key={stage.id}
                    className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{stage.stage}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" />
                        Started {formatDistanceET(stage.entered_at, { addSuffix: true })}
                      </div>
                      {stage.notes && (
                        <div className="text-sm text-muted-foreground mt-1">Note: {stage.notes}</div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExitingStageId(stage.id)}
                    >
                      <Square className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exit Stage Form */}
          {exitingStageId && (
            <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
              <h3 className="font-semibold">Complete Stage</h3>
              
              {activeStages.find(s => s.id === exitingStageId)?.stage === 'Coating' && (
                <div>
                  <Label htmlFor="cornstarch">Corn Starch Used (kg)</Label>
                  <Input
                    id="cornstarch"
                    type="number"
                    step="0.01"
                    value={cornStarchKg}
                    onChange={(e) => setCornStarchKg(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="quality">Quality Check Passed</Label>
                <Switch
                  id="quality"
                  checked={qualityPassed}
                  onCheckedChange={setQualityPassed}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="sticking">Sticking Issue Detected</Label>
                <Switch
                  id="sticking"
                  checked={hasStickingIssue}
                  onCheckedChange={setHasStickingIssue}
                />
              </div>

              <div>
                <Label htmlFor="exit-notes">Completion Notes</Label>
                <Textarea
                  id="exit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any observations, issues, or notes..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleExitStage}>Save & Complete</Button>
                <Button variant="outline" onClick={() => setExitingStageId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Start New Stage */}
          {!exitingStageId && (
            <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
              <h3 className="font-semibold">Start New Stage</h3>
              
              <div>
                <Label htmlFor="stage">Production Stage</Label>
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger id="stage">
                    <SelectValue placeholder="Select stage..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_STAGES.map(stage => (
                      <SelectItem key={stage} value={stage}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="start-notes">Notes</Label>
                <Textarea
                  id="start-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any setup notes or observations..."
                  rows={2}
                />
              </div>

              <Button onClick={handleEnterStage} disabled={!selectedStage}>
                <Play className="h-4 w-4 mr-2" />
                Start Stage
              </Button>
            </div>
          )}

          {/* Completed Stages History */}
          {completedStages.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Completed Stages</h3>
              <div className="space-y-2">
                {completedStages.map(stage => (
                  <div
                    key={stage.id}
                    className="p-3 bg-muted/20 rounded-lg border"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{stage.stage}</span>
                          {stage.quality_check_passed ? (
                            <Badge variant="default" className="bg-success">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Passed
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                          {stage.sticking_issue && (
                            <Badge variant="outline" className="text-warning">
                              Sticking Issue
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Duration: {stage.stage_duration_hours?.toFixed(1)}h
                        </div>
                        {stage.corn_starch_used_kg && (
                          <div className="text-sm text-muted-foreground">
                            Corn Starch: {stage.corn_starch_used_kg}kg
                          </div>
                        )}
                        {stage.notes && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {stage.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground text-right">
                        <div>{formatET(stage.entered_at, "M/d/yyyy")}</div>
                        <div>{new Date(stage.entered_at).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
