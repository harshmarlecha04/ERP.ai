import { useState } from 'react';
import { AlertTriangle, Shield, Clock, FileText, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useHRAccessRequests } from '@/hooks/useHRAccessRequests';
import { useToast } from '@/hooks/use-toast';

interface HRAccessRequestFormProps {
  employeeId?: string;
  onRequestSubmitted?: () => void;
  className?: string;
}

export const HRAccessRequestForm = ({ 
  employeeId: initialEmployeeId, 
  onRequestSubmitted,
  className = ""
}: HRAccessRequestFormProps) => {
  const [employeeId, setEmployeeId] = useState(initialEmployeeId || '');
  const [accessReason, setAccessReason] = useState('');
  const [accessType, setAccessType] = useState<'view' | 'update'>('view');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const { submitAccessRequest } = useHRAccessRequests();
  const { toast } = useToast();

  const handleSubmitRequest = async () => {
    if (!employeeId.trim() || !accessReason.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide an employee ID and access reason.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await submitAccessRequest(employeeId.trim(), accessReason.trim(), accessType);
      
      if (result.success) {
        toast({
          title: "Request Submitted",
          description: "Your access request has been submitted for admin approval.",
        });
        setSubmitted(true);
        setEmployeeId('');
        setAccessReason('');
        setAccessType('view');
        onRequestSubmitted?.();
      } else {
        toast({
          title: "Request Failed",
          description: result.error || "Failed to submit access request.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Request Failed",
        description: "An unexpected error occurred while submitting your request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={className}>
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/10 dark:border-green-800">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-lg font-semibold text-green-800 dark:text-green-200">
              Request Submitted Successfully
            </CardTitle>
            <CardDescription className="text-green-700 dark:text-green-300">
              Your access request has been sent to administrators for review and approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/20 p-3">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-800 dark:text-green-200">
                    What happens next?
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    An administrator will review your request and either approve or deny access. 
                    You will be notified of the decision. Approved access is typically granted for 8 hours.
                  </p>
                </div>
              </div>
            </div>
            <Button 
              onClick={() => setSubmitted(false)}
              variant="outline"
              className="w-full"
            >
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/10 dark:border-amber-800">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
            <Shield className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-lg font-semibold text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
            HR Data Access Request
          </CardTitle>
          <CardDescription className="text-amber-700 dark:text-amber-300">
            Access to sensitive employee data requires administrator approval for enhanced security.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-amber-100 dark:bg-amber-900/20 p-3">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-200">
                  Enhanced Security Protocol
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Access to sensitive employee data now requires administrator approval to ensure data protection compliance and audit trail.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="employee-id" className="text-sm font-medium">
                Employee ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="employee-id"
                placeholder="Enter employee ID"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={!!initialEmployeeId}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="access-type" className="text-sm font-medium">
                Access Type <span className="text-destructive">*</span>
              </Label>
              <Select value={accessType} onValueChange={(value: 'view' | 'update') => setAccessType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select access type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View Only</SelectItem>
                  <SelectItem value="update">View & Update</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Select "View Only" for read access or "View & Update" if you need to modify data
              </p>
            </div>

            <div>
              <Label htmlFor="access-reason" className="text-sm font-medium">
                Business Justification <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="access-reason"
                placeholder="Please provide a detailed business justification for accessing this employee's sensitive data..."
                value={accessReason}
                onChange={(e) => setAccessReason(e.target.value)}
                className="mt-1"
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Include specific reasons such as HR investigation, performance review, compliance audit, payroll inquiry, etc.
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleSubmitRequest}
                disabled={isSubmitting || !employeeId.trim() || !accessReason.trim()}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};