import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOfficeSupplyRequests, useUpdateRequestStatus, useUpdateRequest, useDeleteRequest } from "@/hooks/useOfficeSupplyRequests";
import { Check, X, Package as PackageIcon, Clock, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { DeleteConfirmationModal } from "@/components/inventory/DeleteConfirmationModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatET } from "@/utils/dateUtils";

type StatusFilter = "all" | "pending" | "approved" | "fulfilled" | "rejected";

export const OfficeSupplyRequestsTable = () => {
  const { data: requests, isLoading } = useOfficeSupplyRequests();
  const updateStatus = useUpdateRequestStatus();
  const updateRequest = useUpdateRequest();
  const deleteRequest = useDeleteRequest();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    requestId: string;
    action: "approve" | "reject" | "fulfill";
    itemName: string;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    request: typeof requests extends (infer U)[] ? U : never;
  } | null>(null);
  const [editForm, setEditForm] = useState({
    item_name: "",
    quantity_requested: 0,
    unit_of_measure: "units",
    reason: "",
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    requestId: string;
    itemName: string;
  } | null>(null);

  const filteredRequests = requests?.filter(req => 
    statusFilter === "all" ? true : req.status === statusFilter
  );

  const handleAction = async () => {
    if (!actionDialog) return;

    const statusMap = {
      approve: "approved" as const,
      reject: "rejected" as const,
      fulfill: "fulfilled" as const,
    };

    await updateStatus.mutateAsync({
      id: actionDialog.requestId,
      status: statusMap[actionDialog.action],
      rejection_reason: actionDialog.action === "reject" ? rejectionReason : undefined,
      notes: notes || undefined,
    });

    setActionDialog(null);
    setNotes("");
    setRejectionReason("");
  };

  const handleEdit = (request: any) => {
    setEditForm({
      item_name: request.item_name,
      quantity_requested: request.quantity_requested,
      unit_of_measure: request.unit_of_measure || "units",
      reason: request.reason || "",
    });
    setEditDialog({ open: true, request });
  };

  const handleUpdateRequest = async () => {
    if (!editDialog) return;

    await updateRequest.mutateAsync({
      id: editDialog.request.id,
      ...editForm,
    });

    setEditDialog(null);
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;

    await deleteRequest.mutateAsync(deleteDialog.requestId);
    setDeleteDialog(null);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      fulfilled: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "";
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading requests...</div>;
  }

  return (
    <div className="space-y-4">
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="fulfilled">Fulfilled</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filteredRequests || filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <PackageIcon className="h-12 w-12 opacity-50" />
                    <p>No requests found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.item_name}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{request.requester_name}</p>
                      <p className="text-xs text-muted-foreground">{request.requester_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{request.quantity_requested}</TableCell>
                  <TableCell>{request.unit_of_measure || "units"}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatET(request.created_at, "MMM d, yyyy")}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{request.reason || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {request.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(request)}
                            title="Edit Request"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                requestId: request.id,
                                itemName: request.item_name,
                              })
                            }
                            title="Delete Request"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setActionDialog({
                                open: true,
                                requestId: request.id,
                                action: "approve",
                                itemName: request.item_name,
                              })
                            }
                            title="Approve Request"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setActionDialog({
                                open: true,
                                requestId: request.id,
                                action: "reject",
                                itemName: request.item_name,
                              })
                            }
                            title="Reject Request"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {request.status === "approved" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setActionDialog({
                              open: true,
                              requestId: request.id,
                              action: "fulfill",
                              itemName: request.item_name,
                            })
                          }
                          title="Mark as Fulfilled"
                        >
                          <Clock className="h-4 w-4" />
                          Fulfill
                        </Button>
                      )}
                      {(request.status === "fulfilled" || request.status === "rejected") && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                requestId: request.id,
                                itemName: request.item_name,
                              })
                            }
                            title="Delete Request"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={actionDialog?.open || false} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "approve" && "Approve Request"}
              {actionDialog?.action === "reject" && "Reject Request"}
              {actionDialog?.action === "fulfill" && "Mark as Fulfilled"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Item: <span className="font-medium text-foreground">{actionDialog?.itemName}</span>
            </p>

            {actionDialog?.action === "reject" && (
              <div>
                <Label htmlFor="rejection_reason">Rejection Reason *</Label>
                <Textarea
                  id="rejection_reason"
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Why is this request being rejected?"
                />
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={updateStatus.isPending || (actionDialog?.action === "reject" && !rejectionReason)}
            >
              {updateStatus.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog?.open || false} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_item_name">Item Name *</Label>
              <Input
                id="edit_item_name"
                value={editForm.item_name}
                onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                placeholder="Enter item name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_quantity">Quantity *</Label>
                <Input
                  id="edit_quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={editForm.quantity_requested > 0 ? editForm.quantity_requested : ""}
                  onChange={(e) => {
                    const value = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                    setEditForm({ ...editForm, quantity_requested: value });
                  }}
                  placeholder="Enter quantity"
                />
              </div>

              <div>
                <Label htmlFor="edit_unit">Unit of Measure *</Label>
                <Input
                  id="edit_unit"
                  value={editForm.unit_of_measure}
                  onChange={(e) => setEditForm({ ...editForm, unit_of_measure: e.target.value })}
                  placeholder="e.g., units, boxes"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_reason">Reason (optional)</Label>
              <Textarea
                id="edit_reason"
                value={editForm.reason}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                placeholder="Why is this item needed?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRequest}
              disabled={updateRequest.isPending || !editForm.item_name || editForm.quantity_requested <= 0}
            >
              {updateRequest.isPending ? "Updating..." : "Update Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationModal
        isOpen={deleteDialog?.open || false}
        onClose={() => setDeleteDialog(null)}
        onConfirm={handleDelete}
        title="Delete Request"
        description={`Are you sure you want to delete the request for "${deleteDialog?.itemName}"? This action cannot be undone.`}
      />
    </div>
  );
};
