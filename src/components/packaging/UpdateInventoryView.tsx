import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { usePackagingBalances, useCreatePackagingMovement } from "@/hooks/usePackagingInventory";
import { useLabelInventory, useCreateLabelInventoryRecord } from "@/hooks/useLabelInventory";
import { useCustomers } from "@/hooks/useCustomers";
import { usePackagingSchedule, PackagingScheduleItem } from "@/hooks/usePackagingSchedule";
import {
  useRecentSessions,
  useLastSession,
  useCreateUpdateSession,
  useCreateSessionItem,
  useUpdateSessionTotals,
  useDeleteUpdateSession,
} from "@/hooks/useInventoryUpdateSessions";
import { toast } from "sonner";
import { Minus, PackageMinus, Loader2, AlertTriangle, Search, X, CalendarIcon, Undo2, CheckCircle, Package } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { format, isToday } from "date-fns";
import { parseDateString, formatET } from "@/utils/dateUtils";

import { UpdateHistorySection } from "./UpdateHistorySection";
import { UndoSessionDialog } from "./UndoSessionDialog";
import { CompletePackagingModal } from "./CompletePackagingModal";
import { cn } from "@/lib/utils";

interface DeductionState {
  [itemId: string]: string;
}

export function UpdateInventoryView() {
  const [deductions, setDeductions] = useState<DeductionState>({});
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Bottles", "Caps", "Pouches", "Corrugated", "Labels"])
  );
  const [labelSearchQuery, setLabelSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const [sessionToUndo, setSessionToUndo] = useState<any>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<PackagingScheduleItem | null>(null);
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'today' | 'overdue' | 'completed'>('all');

  const { data: balances = [], isLoading: isLoadingPackaging } = usePackagingBalances({});
  const { data: labelInventory = [], isLoading: isLoadingLabels } = useLabelInventory();
  const { customers = [] } = useCustomers();
  const { mutateAsync: createMovement } = useCreatePackagingMovement();
  const { mutateAsync: createLabelRecord } = useCreateLabelInventoryRecord();

  // Fetch ALL scheduled packaging (pending + in_progress + completed) across all dates
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const todayStr = formatET(new Date(), 'yyyy-MM-dd');
  const { data: allSchedules = [], isLoading: isLoadingSchedule } = usePackagingSchedule({
    statuses: ['pending', 'in_progress', 'completed'],
    showAll: true,
  });

  const allIncompleteSchedules = useMemo(
    () => allSchedules.filter((s) => s.status !== 'completed'),
    [allSchedules]
  );

  const scheduledPackaging = useMemo(() => {
    if (scheduleFilter === 'today') {
      return allIncompleteSchedules.filter((s) => s.schedule_date === todayStr);
    }
    if (scheduleFilter === 'overdue') {
      return allIncompleteSchedules.filter((s) => s.schedule_date < todayStr);
    }
    if (scheduleFilter === 'completed') {
      return allSchedules
        .filter((s) => s.status === 'completed')
        .slice()
        .sort((a, b) => b.schedule_date.localeCompare(a.schedule_date));
    }
    // 'all' → incomplete from today forward
    return allIncompleteSchedules.filter((s) => s.schedule_date >= todayStr);
  }, [allSchedules, allIncompleteSchedules, scheduleFilter, todayStr]);


  
  // Session management hooks
  const { data: recentSessions = [], isLoading: isLoadingSessions } = useRecentSessions(10);
  const { data: lastSession } = useLastSession();
  const { mutateAsync: createSession } = useCreateUpdateSession();
  const { mutateAsync: createSessionItem } = useCreateSessionItem();
  const { mutateAsync: updateSessionTotals } = useUpdateSessionTotals();
  const { mutateAsync: deleteSession } = useDeleteUpdateSession();

  // Undo confirmation handler - must be before any conditional returns
  const confirmUndo = useCallback(async () => {
    if (!sessionToUndo) {
      console.warn("⚠️ No session to undo");
      return;
    }
    
    console.log("🔄 Starting undo for session:", sessionToUndo.id);
    setIsUndoing(true);
    
    try {
      await deleteSession(sessionToUndo.id);
      console.log("✅ Session deleted successfully");
      setShowUndoDialog(false);
      setSessionToUndo(null);
      // Reset current session if it was undone
      if (currentSessionId === sessionToUndo.id) {
        setCurrentSessionId(null);
      }
      toast.success("Inventory updates undone successfully");
    } catch (error: any) {
      console.error("❌ Error undoing session:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      
      // Show user-friendly error message
      const errorMessage = error?.message || "Failed to undo session";
      toast.error(`Undo failed: ${errorMessage}`);
      
      // Keep dialog open on error so user can try again or cancel
    } finally {
      setIsUndoing(false);
    }
  }, [sessionToUndo, deleteSession, currentSessionId, setIsUndoing, setShowUndoDialog, setSessionToUndo, setCurrentSessionId]);

  // Calculate label balances from label_inventory
  const labelBalances = useMemo(() => {
    if (!labelInventory.length) return [];
    
    // Group by customer_product and sum on_hand values
    const grouped = labelInventory.reduce((acc, record) => {
      const key = record.customer_product;
      if (!acc[key]) {
        acc[key] = {
          customer_product: key,
          total_on_hand: 0,
          customer_id: record.customer_id,
          product_name: record.product_name,
        };
      }
      acc[key].total_on_hand += (record.on_hand || 0);
      return acc;
    }, {} as Record<string, any>);
    
    // Convert to array format matching packaging items
    return Object.values(grouped).map((item: any) => {
      const customer = customers.find(c => c.id === item.customer_id);
      const customerName = customer?.company_name || 'Unknown';
      
      return {
        item_id: item.customer_product,
        item_name: `${customerName} - ${item.product_name || item.customer_product}`,
        on_hand: item.total_on_hand,
        uom: 'labels',
        category: 'Labels',
        sku: null,
        customer_id: item.customer_id,
        product_name: item.product_name,
        customer_product: item.customer_product,
      };
    });
  }, [labelInventory, customers]);

  // Combine packaging and label balances, then group by category
  const groupedBalances = useMemo(() => {
    const allItems = [...balances, ...labelBalances];
    const grouped: Record<string, typeof allItems> = {};
    
    allItems.forEach((balance) => {
      const category = balance.category || "Other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(balance);
    });
    
    return grouped;
  }, [balances, labelBalances]);

  // Filtered labels based on search query
  const filteredLabels = useMemo(() => {
    if (!labelSearchQuery.trim()) {
      return groupedBalances["Labels"] || [];
    }
    
    const query = labelSearchQuery.toLowerCase();
    const labelItems = groupedBalances["Labels"] || [];
    
    return labelItems.filter((item) => {
      const itemName = item.item_name.toLowerCase();
      const productName = ((item as any).product_name || "").toLowerCase();
      const customer = customers.find(c => c.id === (item as any).customer_id);
      const customerName = (customer?.company_name || "").toLowerCase();
      
      return (
        itemName.includes(query) ||
        productName.includes(query) ||
        customerName.includes(query)
      );
    });
  }, [labelSearchQuery, groupedBalances, customers]);

  const handleDeductionChange = (itemId: string, value: string) => {
    // Allow only positive numbers or empty string
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setDeductions((prev) => ({ ...prev, [itemId]: value }));
    }
  };

  const handleIndividualDeduct = async (
    itemId: string, 
    itemName: string, 
    currentQty: number,
    category?: string,
    itemData?: any
  ) => {
    const deductAmount = parseFloat(deductions[itemId] || "0");
    
    if (deductAmount <= 0) {
      toast.error("Please enter a valid deduction amount");
      return;
    }

    setProcessingItems((prev) => new Set(prev).add(itemId));

    try {
      // Create session if doesn't exist
      let sessionId = currentSessionId;
      if (!sessionId) {
        const session = await createSession({
          session_date: format(selectedDate, 'yyyy-MM-dd'),
          notes: 'Manual inventory update'
        });
        sessionId = session.id;
        setCurrentSessionId(sessionId);
      }

      let movementId: string | undefined;
      let labelInventoryId: string | undefined;

      // Check if this is a label item
      if (category === "Labels") {
        const record = await createLabelRecord({
          customer_product: itemData.customer_product,
          date: format(selectedDate, 'yyyy-MM-dd'),
          received_qty: 0,
          used_qty: deductAmount,
          on_hand: -deductAmount,
          source_sheet: null,
          customer_id: itemData.customer_id,
          product_name: itemData.product_name,
        });
        labelInventoryId = record.id;
      } else {
        // Regular packaging item
        const movement = await createMovement({
          item_id: itemId,
          move_type: "USAGE",
          qty: deductAmount,
          move_date: format(selectedDate, 'yyyy-MM-dd'),
          notes: "Inventory deduction",
        });
        movementId = movement.id;
      }

      // Link to session
      await createSessionItem({
        session_id: sessionId,
        movement_id: movementId,
        label_inventory_id: labelInventoryId,
        item_type: category === "Labels" ? 'LABEL' : 'PACKAGING',
        item_name: itemName,
        quantity_deducted: deductAmount
      });

      // Update session totals
      await updateSessionTotals(sessionId);

      toast.success(`Deducted ${deductAmount} from ${itemName}`);
      
      // Clear the input for this item
      setDeductions((prev) => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    } catch (error) {
      console.error("Error deducting inventory:", error);
      toast.error(`Failed to deduct from ${itemName}`);
    } finally {
      setProcessingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleBatchDeduct = async () => {
    const itemsToDeduct = Object.entries(deductions).filter(
      ([_, value]) => parseFloat(value || "0") > 0
    );

    if (itemsToDeduct.length === 0) {
      toast.error("No deductions to process");
      return;
    }

    setShowBatchConfirm(false);
    setIsBatchProcessing(true);

    try {
      // Create session if doesn't exist
      let sessionId = currentSessionId;
      if (!sessionId) {
        const session = await createSession({
          session_date: format(selectedDate, 'yyyy-MM-dd'),
          notes: 'Batch inventory update'
        });
        sessionId = session.id;
        setCurrentSessionId(sessionId);
      }

      let successCount = 0;
      let failCount = 0;

      // Get all items (packaging + labels)
      const allItems = [...balances, ...labelBalances];

      for (const [itemId, value] of itemsToDeduct) {
        try {
          const deductAmount = parseFloat(value);
          const item = allItems.find(i => i.item_id === itemId);
          
          let movementId: string | undefined;
          let labelInventoryId: string | undefined;

          // Check if this is a label item
          if (item?.category === "Labels") {
            const record = await createLabelRecord({
              customer_product: (item as any).customer_product,
              date: format(selectedDate, 'yyyy-MM-dd'),
              received_qty: 0,
              used_qty: deductAmount,
              on_hand: -deductAmount,
              source_sheet: null,
              customer_id: (item as any).customer_id,
              product_name: (item as any).product_name,
            });
            labelInventoryId = record.id;
          } else {
            // Regular packaging item
            const movement = await createMovement({
              item_id: itemId,
              move_type: "USAGE",
              qty: deductAmount,
              move_date: format(selectedDate, 'yyyy-MM-dd'),
              notes: "Batch inventory deduction",
            });
            movementId = movement.id;
          }

          // Link to session
          await createSessionItem({
            session_id: sessionId,
            movement_id: movementId,
            label_inventory_id: labelInventoryId,
            item_type: item?.category === "Labels" ? 'LABEL' : 'PACKAGING',
            item_name: item?.item_name || 'Unknown',
            quantity_deducted: deductAmount
          });

          successCount++;
        } catch (error) {
          console.error(`Error deducting from item ${itemId}:`, error);
          failCount++;
        }
      }

      // Update session totals
      if (sessionId) {
        await updateSessionTotals(sessionId);
      }

      setIsBatchProcessing(false);
      
      if (successCount > 0) {
        toast.success(`Successfully deducted ${successCount} items`);
        setDeductions({});
      }
      
      if (failCount > 0) {
        toast.error(`Failed to deduct ${failCount} items`);
      }
    } catch (error) {
      console.error("Error in batch deduction:", error);
      toast.error("Failed to process batch deduction");
      setIsBatchProcessing(false);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const pendingDeductionsCount = Object.values(deductions).filter(
    (v) => parseFloat(v || "0") > 0
  ).length;

  const totalItemsCount = balances.length + labelBalances.length;

  const isLoading = isLoadingPackaging || isLoadingLabels;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleShowUndoDialog = () => {
    console.log("📝 Opening undo dialog for last session:", lastSession);
    if (lastSession) {
      setSessionToUndo(lastSession);
      setShowUndoDialog(true);
    }
  };

  const handleUndoSession = (sessionId: string) => {
    console.log("📝 Opening undo dialog for session:", sessionId);
    const session = recentSessions.find(s => s.id === sessionId);
    if (session) {
      console.log("📝 Session found:", session);
      setSessionToUndo(session);
      setShowUndoDialog(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Update Inventory</h2>
          <p className="text-muted-foreground">
            Deduct quantities from packaging inventory
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Update Date:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Undo Last Entry Button */}
          {lastSession && (
            <Button 
              variant="outline" 
              onClick={handleShowUndoDialog}
              className="gap-2"
            >
              <Undo2 className="h-4 w-4" />
              Undo Last Entry
            </Button>
          )}
        </div>
      </div>

      {/* Date Warning if not today */}
      {!isToday(selectedDate) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Historical Update</AlertTitle>
          <AlertDescription>
            You are updating inventory for {format(selectedDate, "MMMM d, yyyy")}
          </AlertDescription>
        </Alert>
      )}

      {/* Scheduled Packaging Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Scheduled Packaging</CardTitle>
              <Badge variant="secondary">
                {scheduledPackaging.length} {scheduleFilter === 'today' ? 'for today' : scheduleFilter === 'overdue' ? 'overdue' : scheduleFilter === 'completed' ? 'completed' : 'upcoming'}
              </Badge>

            </div>
            <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-0.5">
              {(['all', 'today', 'overdue', 'completed'] as const).map((f) => (
                <Button
                  key={f}
                  variant={scheduleFilter === f ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs capitalize"
                  onClick={() => setScheduleFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'today' ? 'Today' : f === 'overdue' ? 'Overdue' : 'Completed'}
                </Button>
              ))}
            </div>
          </div>
          <CardDescription>
            {scheduleFilter === 'completed'
              ? 'History of completed packaging runs'
              : 'Upcoming scheduled packaging runs — complete a run to automatically deduct inventory'}
          </CardDescription>

        </CardHeader>
        <CardContent>
          {isLoadingSchedule ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : scheduledPackaging.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground space-y-2">
              <p>
                {scheduleFilter === 'completed'
                  ? 'No completed packaging runs yet.'
                  : `No scheduled packaging found${scheduleFilter !== 'all' ? ` (${scheduleFilter})` : ''}.`}
              </p>
              {scheduleFilter !== 'all' && scheduleFilter !== 'completed' && allIncompleteSchedules.length > 0 && (
                <p className="text-sm">
                  <span className="text-primary font-medium">{allIncompleteSchedules.length}</span> total incomplete.{' '}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() => setScheduleFilter('all')}
                  >
                    Show all
                  </Button>
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead className="text-center">Expected Bottles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledPackaging.map((item) => {
                  const isOverdue = item.schedule_date < todayStr && item.status !== 'completed';
                  return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="font-normal">
                          {formatET(item.schedule_date, 'MMM d')}
                        </Badge>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Overdue</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{item.customer_name}</TableCell>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.count}</Badge>
                    </TableCell>

                    <TableCell className="text-center font-mono">
                      {item.expected_bottles.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={item.status === 'completed' ? 'default' : 'outline'}
                        className={item.status === 'completed' ? 'bg-green-500' : ''}
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedScheduleItem(item);
                          setShowCompleteModal(true);
                        }}
                        disabled={item.status === 'completed'}
                        className="gap-1"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Complete
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}

              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Categories */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalItemsCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Pending Deductions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingDeductionsCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Object.keys(groupedBalances).length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Batch Actions */}
          {pendingDeductionsCount > 0 && (
            <div className="flex gap-3">
              <Button
                onClick={() => setShowBatchConfirm(true)}
                disabled={isBatchProcessing}
                className="gap-2"
              >
                {isBatchProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PackageMinus className="h-4 w-4" />
                )}
                Deduct All ({pendingDeductionsCount})
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeductions({})}
                disabled={isBatchProcessing}
              >
                Clear All
              </Button>
            </div>
          )}

          {/* Category Sections */}
          <div className="space-y-4">
            {Object.entries(groupedBalances).map(([category, items]) => (
          <Card key={category}>
            <Collapsible
              open={expandedCategories.has(category)}
              onOpenChange={() => toggleCategory(category)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{category}</CardTitle>
                      <Badge variant="secondary">{items.length} items</Badge>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        expandedCategories.has(category) ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {/* Search input for Labels category only */}
                  {category === "Labels" && (
                    <div className="mb-4 flex items-center gap-2">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search labels by customer or product..."
                          value={labelSearchQuery}
                          onChange={(e) => setLabelSearchQuery(e.target.value)}
                          className="pl-9 pr-9"
                        />
                        {labelSearchQuery && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLabelSearchQuery("")}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {labelSearchQuery && (
                        <Badge variant="secondary">
                          {filteredLabels.length} of {items.length}
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Current Stock</TableHead>
                        <TableHead className="text-right">Deduct Amount</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {category === "Labels" && labelSearchQuery && filteredLabels.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No labels found matching "{labelSearchQuery}"
                          </TableCell>
                        </TableRow>
                      ) : (
                        (category === "Labels" ? filteredLabels : items).map((item) => {
                        const deductAmount = parseFloat(deductions[item.item_id] || "0");
                        const remaining = item.on_hand - deductAmount;
                        const isProcessing = processingItems.has(item.item_id);
                        const wouldBeNegative = remaining < 0;

                        return (
                          <TableRow key={item.item_id}>
                            <TableCell className="font-medium">
                              {item.item_name}
                              {item.sku && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({item.sku})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={item.on_hand <= 0 ? "destructive" : "secondary"}>
                                {item.on_hand.toLocaleString()} {item.uom}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={deductions[item.item_id] || ""}
                                onChange={(e) =>
                                  handleDeductionChange(item.item_id, e.target.value)
                                }
                                 onKeyDown={(e) => {
                                   if (e.key === "Enter" && deductAmount > 0) {
                                     handleIndividualDeduct(
                                       item.item_id,
                                       item.item_name,
                                       item.on_hand,
                                       category,
                                       item
                                     );
                                   }
                                 }}
                                disabled={isProcessing || isBatchProcessing}
                                className="w-28 text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {wouldBeNegative && deductAmount > 0 && (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                )}
                                <Badge
                                  variant={wouldBeNegative ? "destructive" : "outline"}
                                >
                                  {remaining.toLocaleString()} {item.uom}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                 onClick={() =>
                                   handleIndividualDeduct(
                                     item.item_id,
                                     item.item_name,
                                     item.on_hand,
                                     category,
                                     item
                                   )
                                 }
                                disabled={
                                  deductAmount <= 0 ||
                                  isProcessing ||
                                  isBatchProcessing
                                }
                                className="gap-2"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Minus className="h-3 w-3" />
                                )}
                                Deduct
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
            ))}
          </div>
        </div>

        {/* Right Column - Update History */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <UpdateHistorySection
              sessions={recentSessions}
              onUndoSession={handleUndoSession}
              isLoading={isLoadingSessions}
            />
          </div>
        </div>
      </div>

      {/* Batch Confirmation Dialog */}
      <AlertDialog open={showBatchConfirm} onOpenChange={setShowBatchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Batch Deduction</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to deduct quantities from {pendingDeductionsCount} items
              for {format(selectedDate, "PPP")}.
              This will be tracked in a session that can be undone later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDeduct}>
              Confirm Deduction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo Session Dialog */}
      <UndoSessionDialog
        open={showUndoDialog}
        onOpenChange={setShowUndoDialog}
        session={sessionToUndo}
        onConfirm={confirmUndo}
        isLoading={isUndoing}
      />

      {/* Complete Packaging Modal */}
      <CompletePackagingModal
        open={showCompleteModal}
        onOpenChange={setShowCompleteModal}
        scheduleItem={selectedScheduleItem}
      />
    </div>
  );
}
