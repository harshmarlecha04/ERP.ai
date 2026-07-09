import { useState } from 'react';
import { Clock, CheckCircle, XCircle, User, FileText, Calendar, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useHRAccessRequests } from '@/hooks/useHRAccessRequests';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { formatET } from "@/utils/dateUtils";

export const HRAccessRequestManager = () => {
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [denialReason, setDenialReason] = useState('');
  const [accessDuration, setAccessDuration] = useState('8');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { requests, loading, error, approveRequest, denyRequest, refetch } = useHRAccessRequests();
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-amber-500 text-amber-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="border-green-500 text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'denied':
        return <Badge variant="outline" className="border-red-500 text-red-600"><XCircle className="w-3 h-3 mr-1" />Denied</Badge>;
      case 'expired':
        return <Badge variant="outline" className="border-gray-500 text-gray-600">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    setIsProcessing(true);
    try {
      const result = await approveRequest(requestId, parseInt(accessDuration));
      
      if (result.success) {
        toast({
          title: "Request Approved",
          description: `Access granted for ${accessDuration} hours.`,
        });
        setSelectedRequest(null);
      } else {
        toast({
          title: "Approval Failed",
          description: result.error || "Failed to approve request.",
          variant: "destructive",
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    if (!denialReason.trim()) {
      toast({
        title: "Missing Reason",
        description: "Please provide a reason for denying this request.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await denyRequest(requestId, denialReason.trim());
      
      if (result.success) {
        toast({
          title: "Request Denied",
          description: "The access request has been denied.",
        });
        setSelectedRequest(null);
        setDenialReason('');
      } else {
        toast({
          title: "Denial Failed",
          description: result.error || "Failed to deny request.",
          variant: "destructive",
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!hasPermission('admin')) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/10">
        <CardHeader>
          <CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Access Denied
          </CardTitle>
          <CardDescription className="text-red-700 dark:text-red-300">
            Only administrators can manage HR access requests.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">Loading HR access requests...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/10">
        <CardContent className="py-6">
          <div className="text-red-800 dark:text-red-200">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  const selectedRequestData = requests.find(r => r.id === selectedRequest);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">HR Access Request Manager</h2>
          <p className="text-muted-foreground">
            Manage HR staff requests for accessing sensitive employee data
          </p>
        </div>
        <Button onClick={refetch} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            Pending Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>
            Requests awaiting administrator approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No pending access requests
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Employee ID: {request.employee_id}</span>
                        <Badge variant={request.access_type === 'update' ? 'destructive' : 'secondary'}>
                          {request.access_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Requested: {formatET(request.requested_at, "MMM d, yyyy h:mm a")}
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Business Justification:</Label>
                    <p className="text-sm mt-1 p-2 bg-muted rounded">{request.access_reason}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setSelectedRequest(request.id)}
                      size="sm"
                    >
                      Review & Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedRequest(request.id);
                        setDenialReason('');
                      }}
                    >
                      Deny
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Processed Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Processed Requests</CardTitle>
          <CardDescription>
            Recently approved, denied, or expired access requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {processedRequests.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No processed requests
            </div>
          ) : (
            <div className="space-y-3">
              {processedRequests.slice(0, 10).map((request) => (
                <div key={request.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Employee {request.employee_id}</span>
                      <Badge variant={request.access_type === 'update' ? 'destructive' : 'secondary'} className="text-xs">
                        {request.access_type}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {request.status === 'approved' && request.approved_at && 
                        `Approved: ${formatET(request.approved_at, "MMM d, yyyy h:mm a")}`}
                      {request.status === 'denied' && request.denied_at && 
                        `Denied: ${formatET(request.denied_at, "MMM d, yyyy h:mm a")}`}
                      {request.status === 'expired' && 
                        `Expired: ${formatET(request.expires_at!, "MMM d, yyyy h:mm a")}`}
                    </div>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Access Request</DialogTitle>
          </DialogHeader>
          
          {selectedRequestData && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Employee ID:</Label>
                <p className="text-sm">{selectedRequestData.employee_id}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Access Type:</Label>
                <p className="text-sm">{selectedRequestData.access_type}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Requested At:</Label>
                <p className="text-sm">{formatET(selectedRequestData.requested_at, "MMM d, yyyy h:mm a")}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Business Justification:</Label>
                <p className="text-sm p-2 bg-muted rounded mt-1">{selectedRequestData.access_reason}</p>
              </div>

              <div>
                <Label htmlFor="access-duration" className="text-sm font-medium">
                  Access Duration (hours)
                </Label>
                <Select value={accessDuration} onValueChange={setAccessDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 hours</SelectItem>
                    <SelectItem value="8">8 hours (recommended)</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="72">72 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="denial-reason" className="text-sm font-medium">
                  Denial Reason (if denying)
                </Label>
                <Textarea
                  id="denial-reason"
                  placeholder="Provide reason if denying this request..."
                  value={denialReason}
                  onChange={(e) => setDenialReason(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setDenialReason('');
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequest && handleDenyRequest(selectedRequest)}
              disabled={isProcessing || !denialReason.trim()}
            >
              Deny Request
            </Button>
            <Button
              onClick={() => selectedRequest && handleApproveRequest(selectedRequest)}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Approve Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};