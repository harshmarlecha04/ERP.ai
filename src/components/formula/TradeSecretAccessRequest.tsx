import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Lock, Shield, Clock, Key } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TradeSecretAccessRequestProps {
  formulaId: string;
  formulaName: string;
  onAccessRequested?: () => void;
}

export const TradeSecretAccessRequest: React.FC<TradeSecretAccessRequestProps> = ({
  formulaId,
  formulaName,
  onAccessRequested
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [justification, setJustification] = useState('');
  const [accessLevel, setAccessLevel] = useState('view');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!justification.trim()) {
      toast({
        title: "Justification Required",
        description: "Please provide a business justification for accessing this trade secret formula.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('request_trade_secret_access', {
        _formula_id: formulaId,
        _justification: justification,
        _access_level: accessLevel
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast({
          title: "Access Request Submitted",
          description: `Your request for "${formulaName}" has been submitted and is pending admin approval.`,
        });
        setIsOpen(false);
        setJustification('');
        onAccessRequested?.();
      } else {
        throw new Error(result?.error || 'Failed to submit request');
      }
    } catch (error: any) {
      console.error('Error requesting access:', error);
      toast({
        title: "Request Failed",
        description: error.message || 'Failed to submit access request',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Request Access">
          <Key className="h-4 w-4 text-amber-600" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Trade Secret Access Request
          </DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This formula contains proprietary trade secrets. Access requires admin approval and is tracked for security compliance.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Formula</Label>
            <div className="p-2 bg-gray-50 rounded text-sm font-mono">
              {formulaName}
            </div>
          </div>

          <div>
            <Label htmlFor="access-level" className="text-sm font-medium">
              Access Level Required
            </Label>
            <Select value={accessLevel} onValueChange={setAccessLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View Only</SelectItem>
                <SelectItem value="edit">View & Edit</SelectItem>
                <SelectItem value="full">Full Access</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="justification" className="text-sm font-medium">
              Business Justification *
            </Label>
            <Textarea
              id="justification"
              placeholder="Please explain why you need access to this trade secret formula. Include project details, urgency, and business purpose."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="min-h-[80px]"
              required
            />
          </div>

          <div className="bg-blue-50 p-3 rounded-md text-sm">
            <div className="flex items-center gap-2 text-blue-800 font-medium mb-1">
              <Clock className="h-4 w-4" />
              Access Details
            </div>
            <ul className="text-blue-700 space-y-1 text-xs">
              <li>• Admin approval required before access</li>
              <li>• Access expires after 24 hours</li>
              <li>• All access is logged and monitored</li>
              <li>• Misuse may result in disciplinary action</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || !justification.trim()}
            className="flex-1"
          >
            {isLoading ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};