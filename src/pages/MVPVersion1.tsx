import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Calendar as CalendarIcon, Plus, Trash2, Edit, Package, Wrench, ShoppingCart, CheckCircle2, Loader2, ChevronDown, FolderOpen, AlertCircle, Sparkles, Upload, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCustomers } from '@/hooks/useCustomers';
import { useFormulas } from '@/hooks/useFormulas';
import { useOrderCalculations } from '@/hooks/useOrderCalculations';
import { useComprehensiveMaterialCheck } from '@/hooks/useComprehensiveMaterialCheck';
import { usePackagingBalances } from '@/hooks/usePackagingInventory';
import { useLabelInventory } from '@/hooks/useLabelInventory';
import { OrderCalculationsDisplay } from '@/components/orders/OrderCalculationsDisplay';
import { MaterialStatusCard } from '@/components/orders/MaterialStatusCard';
import { ScheduleNewBatchModal } from '@/components/production/ScheduleNewBatchModal';
import { MaterialReservationModal } from '@/components/orders/MaterialReservationModal';
import { OrdersListTab } from '@/components/mvp/OrdersListTab';
import { OrderDetailModal } from '@/components/mvp/OrderDetailModal';
import { useOrderDraftAutoSave } from '@/hooks/useOrderDraftAutoSave';
import { POScanReviewModal } from '@/components/orders/POScanReviewModal';
import { formatET } from "@/utils/dateUtils";

interface LineItem {
  id: string;
  formulaId: string;
  formulaCode: string;
  formulaName: string;
  bottlesOrdered: number;
  bottleSize: number;
  gummyWeight: number;
  selectedBottleId: string | undefined;
  selectedCapId: string | undefined;
  selectedLabelId: string | undefined;
}

type WorkflowStep = 'form' | 'created' | 'scheduled' | 'reserved';

interface ValidationErrors {
  poNumber?: string;
  customerId?: string;
  dueDate?: string;
  lineItems?: string;
}

export default function MVPVersion1() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { customers } = useCustomers();
  const { formulas } = useFormulas();
  
  const [poNumber, setPoNumber] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [formulaId, setFormulaId] = useState('');
  const [bottlesOrdered, setBottlesOrdered] = useState(0);
  const [bottleSize, setBottleSize] = useState(60);
  const [gummyWeight, setGummyWeight] = useState(3.5);
  const [selectedBottleId, setSelectedBottleId] = useState<string>();
  const [selectedCapId, setSelectedCapId] = useState<string>();
  const [selectedLabelId, setSelectedLabelId] = useState<string>();
  const [dueDate, setDueDate] = useState<Date>();
  const [notes, setNotes] = useState('');
  const [receivedVia, setReceivedVia] = useState('direct_from_customer');
  const [receivedFromEmail, setReceivedFromEmail] = useState('');
  const [receivedDate, setReceivedDate] = useState<Date>(new Date());
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('form');
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [createdOrderNumber, setCreatedOrderNumber] = useState('');
  const [scheduleItemIds, setScheduleItemIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [existingOrderToReplace, setExistingOrderToReplace] = useState<any>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('create');
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState('');

  // Upload PO (AI auto-fill)
  const [draftPdfPath, setDraftPdfPath] = useState<string | null>(null);
  const [draftPdfName, setDraftPdfName] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePoFileSelected = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({ title: 'Invalid file', description: 'Please upload a PDF.', variant: 'destructive' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 20 MB.', variant: 'destructive' });
      return;
    }
    setUploadingPdf(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) throw new Error('Not signed in');
      const path = `drafts/${uid}/${Date.now()}-${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('order-pdfs')
        .upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;
      setDraftPdfPath(path);
      setDraftPdfName(file.name);
      setScanModalOpen(true);
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingPdf(false);
    }
  };

  const handlePrefillFromScan = (payload: {
    header: { po_number: string; due_date: string; special_instructions: string };
    customer_id: string | null;
    lines: Array<{
      formula_id?: string;
      bottle_count: number;
      bottle_size: number | null;
      unit_price: number;
      notes: string;
      selected_bottle_id?: string | null;
      selected_cap_id?: string | null;
      selected_label_id?: string | null;
    }>;
  }) => {
    if (payload.header.po_number) setPoNumber(payload.header.po_number);
    if (payload.customer_id) setCustomerId(payload.customer_id);
    if (payload.header.due_date) {
      const [y, m, d] = payload.header.due_date.split('-').map(Number);
      if (y && m && d) setDueDate(new Date(y, m - 1, d));
    }
    if (payload.header.special_instructions) {
      setNotes((prev) => (prev ? `${prev}\n${payload.header.special_instructions}` : payload.header.special_instructions));
    }
    const newLines: LineItem[] = [];
    for (const l of payload.lines) {
      if (!l.formula_id || !l.bottle_size || !l.bottle_count) continue;
      const f = formulas?.find((x: any) => x.id === l.formula_id);
      if (!f) continue;
      newLines.push({
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        formulaId: l.formula_id,
        formulaCode: f.code,
        formulaName: f.name,
        bottlesOrdered: l.bottle_count,
        bottleSize: l.bottle_size,
        gummyWeight: 3.5,
        selectedBottleId: l.selected_bottle_id || undefined,
        selectedCapId: l.selected_cap_id || undefined,
        selectedLabelId: l.selected_label_id || undefined,
      });
    }
    if (newLines.length) setLineItems((prev) => [...prev, ...newLines]);
  };

  // Collapsible states
  const [orderInfoOpen, setOrderInfoOpen] = useState(true);
  const [productsOpen, setProductsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);

  // Validation
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const poNumberRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLButtonElement>(null);
  const dueDateRef = useRef<HTMLButtonElement>(null);

  // Draft auto-save
  const draftFormData = useMemo(() => {
    if (!poNumber && lineItems.length === 0) return null;
    return {
      poNumber, customerId, lineItems, dueDate: dueDate?.toISOString() || null,
      notes, receivedVia, receivedFromEmail, receivedDate: receivedDate.toISOString(),
    };
  }, [poNumber, customerId, lineItems, dueDate, notes, receivedVia, receivedFromEmail, receivedDate]);

  const { existingDraft, draftLoaded, lastSavedText, clearDraft, discardDraft } = useOrderDraftAutoSave(draftFormData);
  const [draftBannerVisible, setDraftBannerVisible] = useState(true);
  
  // Packaging data
  const { data: bottleOptions } = usePackagingBalances({ category: ['BOTTLES'] });
  const { data: capOptions } = usePackagingBalances({ category: ['CAPS'] });
  const { data: labelOptions } = useLabelInventory({ customer_id: customerId || undefined });
  
  const bottles = bottleOptions || [];
  const caps = capOptions || [];
  const labels = labelOptions || [];
  
  const currentFormula = formulas.find(f => f.id === formulaId);
  
  const { calculations, isCalculating } = useOrderCalculations(
    formulaId, bottlesOrdered, bottleSize, dueDate, gummyWeight
  );
  
  const selectedLabel = labels.find(l => l.id === selectedLabelId);
  const selectedLabelInventory = selectedLabel?.on_hand || undefined;
  
  const materialStatus = useComprehensiveMaterialCheck(
    formulaId, bottlesOrdered, bottleSize,
    calculations?.batchesNeeded || 0,
    selectedLabelInventory, selectedBottleId, selectedCapId, selectedLabelId
  );
  
  useEffect(() => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setOrderNumber(`ORD-${timestamp}-${random}`);
  }, []);
  
  useEffect(() => {
    setFormulaId('');
    resetCurrentLineItem();
  }, [customerId]);
  
  const filteredFormulas = customerId 
    ? formulas.filter(f => f.customer_id === customerId)
    : formulas;
  
  const gummyWeightOptions = [3.0, 3.5, 4.0, 4.5, 5.0];

  // --- Section progress ---
  const sectionsComplete = useMemo(() => {
    let count = 0;
    if (poNumber.trim() && customerId && dueDate) count++;
    if (lineItems.length > 0) count++;
    if (notes.trim()) count++;
    return count;
  }, [poNumber, customerId, dueDate, lineItems, notes]);

  // --- Validation ---
  const validateForm = useCallback((): boolean => {
    const errors: ValidationErrors = {};
    if (!poNumber.trim()) errors.poNumber = 'PO Number is required';
    if (!customerId) errors.customerId = 'Customer is required';
    if (!dueDate) errors.dueDate = 'Due date is required';
    if (lineItems.length === 0) errors.lineItems = 'Add at least one product to the order';
    setValidationErrors(errors);

    // Focus first error
    if (errors.poNumber) {
      setOrderInfoOpen(true);
      setTimeout(() => poNumberRef.current?.focus(), 100);
    } else if (errors.customerId) {
      setOrderInfoOpen(true);
      setTimeout(() => customerRef.current?.focus(), 100);
    } else if (errors.dueDate) {
      setOrderInfoOpen(true);
      setTimeout(() => dueDateRef.current?.focus(), 100);
    } else if (errors.lineItems) {
      setProductsOpen(true);
    }

    return Object.keys(errors).length === 0;
  }, [poNumber, customerId, dueDate, lineItems]);

  // Clear individual errors as user fixes them
  useEffect(() => {
    if (poNumber.trim() && validationErrors.poNumber) {
      setValidationErrors(prev => { const n = {...prev}; delete n.poNumber; return n; });
    }
  }, [poNumber]);
  useEffect(() => {
    if (customerId && validationErrors.customerId) {
      setValidationErrors(prev => { const n = {...prev}; delete n.customerId; return n; });
    }
  }, [customerId]);
  useEffect(() => {
    if (dueDate && validationErrors.dueDate) {
      setValidationErrors(prev => { const n = {...prev}; delete n.dueDate; return n; });
    }
  }, [dueDate]);
  useEffect(() => {
    if (lineItems.length > 0 && validationErrors.lineItems) {
      setValidationErrors(prev => { const n = {...prev}; delete n.lineItems; return n; });
    }
  }, [lineItems]);
  
  const handleAddLineItem = () => {
    if (!formulaId || !currentFormula || bottlesOrdered <= 0 || bottleSize <= 0) {
      toast({
        title: 'Incomplete line item',
        description: 'Please fill in all required fields before adding to cart.',
        variant: 'destructive',
      });
      return;
    }
    
    const isDuplicate = lineItems.some((item, idx) => 
      idx !== editingIndex &&
      item.formulaId === formulaId && 
      item.bottleSize === bottleSize && 
      item.gummyWeight === gummyWeight
    );
    
    if (isDuplicate) {
      toast({
        title: 'Duplicate line item',
        description: 'This product configuration already exists in the cart.',
        variant: 'destructive',
      });
      return;
    }
    
    const newLineItem: LineItem = {
      id: editingIndex !== null ? lineItems[editingIndex].id : `temp-${Date.now()}`,
      formulaId,
      formulaCode: currentFormula.code,
      formulaName: currentFormula.name,
      bottlesOrdered,
      bottleSize,
      gummyWeight,
      selectedBottleId,
      selectedCapId,
      selectedLabelId,
    };
    
    if (editingIndex !== null) {
      const updatedItems = [...lineItems];
      updatedItems[editingIndex] = newLineItem;
      setLineItems(updatedItems);
      setEditingIndex(null);
      toast({ title: 'Line item updated' });
    } else {
      setLineItems([...lineItems, newLineItem]);
      toast({ title: 'Product added to cart' });
    }
    
    resetCurrentLineItem();
  };
  
  const resetCurrentLineItem = () => {
    setFormulaId('');
    setBottlesOrdered(0);
    setBottleSize(60);
    setGummyWeight(3.5);
    setSelectedBottleId(undefined);
    setSelectedCapId(undefined);
    setSelectedLabelId(undefined);
  };
  
  const handleEditLineItem = (index: number) => {
    const item = lineItems[index];
    setFormulaId(item.formulaId);
    setBottlesOrdered(item.bottlesOrdered);
    setBottleSize(item.bottleSize);
    setGummyWeight(item.gummyWeight);
    setSelectedBottleId(item.selectedBottleId);
    setSelectedCapId(item.selectedCapId);
    setSelectedLabelId(item.selectedLabelId);
    setEditingIndex(index);
    setProductsOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleRemoveLineItem = (index: number) => {
    const updatedItems = lineItems.filter((_, idx) => idx !== index);
    setLineItems(updatedItems);
    toast({ title: 'Line item removed' });
    
    if (editingIndex === index) {
      setEditingIndex(null);
      resetCurrentLineItem();
    }
  };
  
  const handleCreateOrder = async () => {
    if (!validateForm()) return;
    
    setIsSaving(true);
    
    try {
      const { data: existingOrder } = await supabase
        .from('order_headers')
        .select('id, order_number, created_at, header_status, po_number')
        .eq('po_number', poNumber.trim())
        .maybeSingle();
      
      if (existingOrder) {
        setExistingOrderToReplace(existingOrder);
        setShowReplaceDialog(true);
        setIsSaving(false);
        return;
      }
      
      const { data: orderHeader, error: headerError } = await supabase
        .from('order_headers')
        .insert({
          order_number: orderNumber,
          po_number: poNumber.trim(),
          customer_id: customerId,
          due_date: dueDate!.toISOString().split('T')[0],
          header_status: 'pending',
          notes,
          received_via: receivedVia,
          received_from_email: receivedFromEmail || null,
          received_date: `${receivedDate.getFullYear()}-${String(receivedDate.getMonth() + 1).padStart(2, '0')}-${String(receivedDate.getDate()).padStart(2, '0')}`,
          ...(draftPdfPath ? { pdf_url: draftPdfPath } : {}),
        })
        .select()
        .single();
      
      if (headerError) throw headerError;
      
      const lineItemsToInsert = lineItems.map((item, index) => ({
        order_id: orderHeader.id,
        line_number: String(index + 1).padStart(3, '0'),
        formula_id: item.formulaId,
        bottles_ordered: item.bottlesOrdered,
        bottle_size: item.bottleSize,
        order_type: 'production',
        production_status: 'pending',
        selected_bottle_id: item.selectedBottleId || null,
        selected_cap_id: item.selectedCapId || null,
        selected_label_id: item.selectedLabelId && item.selectedLabelId !== '__brite_stock__' ? item.selectedLabelId : null,
      }));
      
      const { error: lineItemsError } = await supabase
        .from('order_line_items')
        .insert(lineItemsToInsert);
      
      if (lineItemsError) throw lineItemsError;
      
      supabase.functions.invoke('send-order-email', {
        body: { order_id: orderHeader.id, event_type: 'PO_CREATED' },
      }).catch(err => console.error('Email notification error:', err));

      handleCreateAnother();
      clearDraft();
      
      toast({
        title: 'Order created successfully!',
        description: `PO ${poNumber} has been created with ${lineItems.length} product(s).`,
      });
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: 'Error creating order',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleScheduleSuccess = () => {
    setShowScheduleModal(false);
    setWorkflowStep('scheduled');
    toast({ title: 'Production scheduled', description: 'Batches have been scheduled successfully.' });
  };
  
  const handleReservationSuccess = () => {
    setShowReservationModal(false);
    setWorkflowStep('reserved');
    toast({ title: 'Materials reserved', description: 'Inventory has been reserved for this order.' });
  };
  
  const handleCreateAnother = () => {
    setPoNumber('');
    setLineItems([]);
    setCustomerId('');
    setDueDate(undefined);
    setNotes('');
    setReceivedVia('direct_from_customer');
    setReceivedFromEmail('');
    setReceivedDate(new Date());
    setWorkflowStep('form');
    setCreatedOrderId('');
    setCreatedOrderNumber('');
    setScheduleItemIds([]);
    setValidationErrors({});
    resetCurrentLineItem();
    
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setOrderNumber(`ORD-${timestamp}-${random}`);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReplaceOrder = async () => {
    if (!existingOrderToReplace) return;

    setShowReplaceDialog(false);
    setIsSaving(true);

    try {
      const { error: deleteError } = await supabase
        .from('order_headers')
        .delete()
        .eq('id', existingOrderToReplace.id);

      if (deleteError) throw deleteError;

      toast({
        title: 'Old order deleted',
        description: `Order ${existingOrderToReplace.order_number} has been deleted.`,
      });

      await createOrderDirectly();
    } catch (error: any) {
      console.error('Error replacing order:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to replace the existing order.',
        variant: 'destructive',
      });
      setIsSaving(false);
    }
  };

  const createOrderDirectly = async () => {
    try {
      const { data: orderHeader, error: headerError } = await supabase
        .from('order_headers')
        .insert({
          order_number: orderNumber,
          po_number: poNumber.trim(),
          customer_id: customerId,
          due_date: dueDate?.toISOString().split('T')[0],
          notes,
          header_status: 'pending',
          received_via: receivedVia,
          received_from_email: receivedFromEmail || null,
          received_date: `${receivedDate.getFullYear()}-${String(receivedDate.getMonth() + 1).padStart(2, '0')}-${String(receivedDate.getDate()).padStart(2, '0')}`,
          ...(draftPdfPath ? { pdf_url: draftPdfPath } : {}),
        })
        .select()
        .single();

      if (headerError) throw headerError;

      const lineItemsToInsert = lineItems.map((item, index) => ({
        order_id: orderHeader.id,
        line_number: String(index + 1).padStart(3, '0'),
        formula_id: item.formulaId,
        bottles_ordered: item.bottlesOrdered,
        bottle_size: item.bottleSize,
        order_type: 'production',
        production_status: 'pending',
        selected_bottle_id: item.selectedBottleId || null,
        selected_cap_id: item.selectedCapId || null,
        selected_label_id: item.selectedLabelId && item.selectedLabelId !== '__brite_stock__' ? item.selectedLabelId : null,
      }));

      const { error: lineItemsError } = await supabase
        .from('order_line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      supabase.functions.invoke('send-order-email', {
        body: { order_id: orderHeader.id, event_type: 'PO_CREATED' },
      }).catch(err => console.error('Email notification error:', err));

      setCreatedOrderId(orderHeader.id);
      setCreatedOrderNumber(orderHeader.order_number);
      setWorkflowStep('created');
      setIsSaving(false);
      clearDraft();

      toast({
        title: 'Order created successfully',
        description: `Order ${orderHeader.order_number} has been created with ${lineItems.length} line item(s).`,
      });
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create the order.',
        variant: 'destructive',
      });
      setIsSaving(false);
    }
  };
  
  const totalBottlesInCart = lineItems.reduce((sum, item) => sum + item.bottlesOrdered, 0);
  const errorCount = Object.keys(validationErrors).length;
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Order Management</h1>
            <p className="text-muted-foreground">Create and manage production orders</p>
          </div>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="create">Create Order</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6 mt-6">
          {/* Draft recovery banner */}
          {draftLoaded && existingDraft && draftBannerVisible && workflowStep === 'form' && (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
              <AlertDescription className="flex items-center justify-between">
                <span>Draft order found from {formatET(existingDraft.updated_at, "MMM d, yyyy h:mm a")}.</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => {
                    const d = existingDraft.order_data;
                    if (d.poNumber) setPoNumber(d.poNumber as string);
                    if (d.customerId) setCustomerId(d.customerId as string);
                    if (d.lineItems) setLineItems(d.lineItems as any[]);
                    if (d.dueDate) setDueDate(new Date(d.dueDate as string));
                    if (d.notes) setNotes(d.notes as string);
                    if (d.receivedVia) setReceivedVia(d.receivedVia as string);
                    if (d.receivedFromEmail) setReceivedFromEmail(d.receivedFromEmail as string);
                    setDraftBannerVisible(false);
                  }}>Load Draft</Button>
                  <Button size="sm" variant="outline" onClick={() => { discardDraft(); setDraftBannerVisible(false); }}>Discard</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Draft saved indicator */}
          {lastSavedText && workflowStep === 'form' && (
            <p className="text-xs text-muted-foreground text-right">{lastSavedText}</p>
          )}

          {/* Validation status banner */}
          {workflowStep === 'form' && errorCount > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Fix {errorCount} error{errorCount !== 1 ? 's' : ''} to save order
              </AlertDescription>
            </Alert>
          )}

          {/* Section progress */}
          {workflowStep === 'form' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              <span>Section {sectionsComplete}/3 complete</span>
              <div className="flex gap-1 ml-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className={cn("h-1.5 w-6 rounded-full", i < sectionsComplete ? "bg-primary" : "bg-muted")} />
                ))}
              </div>
            </div>
          )}

          {/* Form Section */}
          {workflowStep === 'form' && (
          <>
            {/* Upload PO (AI Auto-Fill) */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div>
                    <CardTitle className="text-base">Upload PO (AI Auto-Fill)</CardTitle>
                    <CardDescription>
                      Drop a PDF and the AI will extract PO number, dates, products, bottle counts, sizes, and prices.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePoFileSelected(f);
                    e.target.value = '';
                  }}
                />
                <div
                  onClick={() => !uploadingPdf && fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handlePoFileSelected(f);
                  }}
                  className={cn(
                    'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                    uploadingPdf ? 'opacity-60 cursor-wait' : 'hover:border-primary hover:bg-primary/5',
                    draftPdfPath ? 'border-green-500/40 bg-green-500/5' : 'border-muted-foreground/30'
                  )}
                >
                  {uploadingPdf ? (
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                    </div>
                  ) : draftPdfPath ? (
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{draftPdfName}</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 ml-2"
                        onClick={(e) => { e.stopPropagation(); setScanModalOpen(true); }}
                      >
                        Re-open scan
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                      <Upload className="h-6 w-6" />
                      <span><span className="font-medium text-foreground">Click to upload</span> or drag a PO PDF here</span>
                      <span className="text-xs">PDF · max 20 MB</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Order Information Section — Collapsible */}
            <Collapsible open={orderInfoOpen} onOpenChange={setOrderInfoOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <CardTitle>Order Information</CardTitle>
                          <CardDescription>Basic order details and customer information</CardDescription>
                        </div>
                      </div>
                      <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", orderInfoOpen && "rotate-180")} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>PO Number *</Label>
                        <Input
                          ref={poNumberRef}
                          placeholder="Enter PO number..."
                          value={poNumber}
                          onChange={(e) => setPoNumber(e.target.value)}
                          className={cn(validationErrors.poNumber && "border-destructive")}
                        />
                        {validationErrors.poNumber && <p className="text-sm text-destructive">{validationErrors.poNumber}</p>}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Customer *</Label>
                        <Select value={customerId} onValueChange={setCustomerId}>
                          <SelectTrigger ref={customerRef} className={cn(validationErrors.customerId && "border-destructive")}>
                            <SelectValue placeholder="Select customer..." />
                          </SelectTrigger>
                          <SelectContent>
                            {customers?.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.company_code} — {customer.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {validationErrors.customerId && <p className="text-sm text-destructive">{validationErrors.customerId}</p>}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Due Date *</Label>
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            ref={dueDateRef}
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !dueDate && 'text-muted-foreground',
                              validationErrors.dueDate && 'border-destructive'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 h-[350px]" align="start">
                          <Calendar
                            mode="single"
                            selected={dueDate}
                            onSelect={(date) => {
                              setDueDate(date);
                              setDatePickerOpen(false);
                            }}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      {validationErrors.dueDate && <p className="text-sm text-destructive">{validationErrors.dueDate}</p>}
                    </div>
                    
                    {/* Intake Metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                      <div className="space-y-2">
                        <Label>PO Received Via</Label>
                        <Select value={receivedVia} onValueChange={setReceivedVia}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="direct_from_customer">Direct from Customer</SelectItem>
                            <SelectItem value="forwarded_by_boss">Forwarded by Boss</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Received From Email</Label>
                        <Input
                          type="email"
                          value={receivedFromEmail}
                          onChange={(e) => setReceivedFromEmail(e.target.value)}
                          placeholder="sender@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>PO Received Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(receivedDate, 'PPP')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 h-[350px]" align="start">
                            <Calendar
                              mode="single"
                              selected={receivedDate}
                              onSelect={(date) => date && setReceivedDate(date)}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
            
            {/* Add Product Section — Collapsible */}
            <Collapsible open={productsOpen} onOpenChange={setProductsOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <CardTitle>{editingIndex !== null ? 'Edit Product' : 'Add Product'}</CardTitle>
                          <CardDescription>Configure a product and add it to the order</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {lineItems.length > 0 && (
                          <Badge variant="secondary">{lineItems.length} in cart</Badge>
                        )}
                        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", productsOpen && "rotate-180")} />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {validationErrors.lineItems && (
                      <p className="text-sm text-destructive">{validationErrors.lineItems}</p>
                    )}
                    {/* Formula Selection */}
                    <div className="space-y-2">
                      <Label>Formula *</Label>
                      <Select value={formulaId} onValueChange={setFormulaId} disabled={!customerId}>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !customerId 
                              ? "Select customer first..." 
                              : filteredFormulas.length === 0 
                                ? "No formulas for this customer" 
                                : "Select formula..."
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredFormulas.length === 0 ? (
                            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                              No formulas available for this customer
                            </div>
                          ) : (
                            filteredFormulas.map((formula) => (
                              <SelectItem key={formula.id} value={formula.id}>
                                {formula.code} — {formula.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Bottles Ordered *</Label>
                        <Input
                          type="number"
                          min="0"
                          value={bottlesOrdered || ''}
                          onChange={(e) => setBottlesOrdered(parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Bottle Size *</Label>
                        <Select value={bottleSize.toString()} onValueChange={(v) => setBottleSize(parseInt(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 count</SelectItem>
                            <SelectItem value="60">60 count</SelectItem>
                            <SelectItem value="90">90 count</SelectItem>
                            <SelectItem value="120">120 count</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Gummy Weight (g) *</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={gummyWeight || ''}
                            onChange={(e) => setGummyWeight(parseFloat(e.target.value) || 0)}
                            className="flex-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          {gummyWeightOptions.map((weight) => (
                            <Button
                              key={weight}
                              type="button"
                              variant={gummyWeight === weight ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setGummyWeight(weight)}
                            >
                              {weight}g
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Packaging Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Bottle Type</Label>
                        <Select value={selectedBottleId} onValueChange={setSelectedBottleId}>
                          <SelectTrigger><SelectValue placeholder="Select bottle..." /></SelectTrigger>
                          <SelectContent>
                            {bottles.map((bottle) => (
                              <SelectItem key={bottle.item_id} value={bottle.item_id}>
                                {bottle.item_name} ({bottle.on_hand.toLocaleString()} available)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Cap Type</Label>
                        <Select value={selectedCapId} onValueChange={setSelectedCapId}>
                          <SelectTrigger><SelectValue placeholder="Select cap..." /></SelectTrigger>
                          <SelectContent>
                            {caps.map((cap) => (
                              <SelectItem key={cap.item_id} value={cap.item_id}>
                                {cap.item_name} ({cap.on_hand.toLocaleString()} available)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Label Type</Label>
                        <Select value={selectedLabelId} onValueChange={setSelectedLabelId}>
                          <SelectTrigger><SelectValue placeholder="Select label..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__brite_stock__">Brite Stock</SelectItem>
                            {labels.map((label) => (
                              <SelectItem key={label.id} value={label.id}>
                                {label.customer_product} ({label.on_hand.toLocaleString()} available)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {calculations && formulaId && (
                      <div className="pt-4">
                        <OrderCalculationsDisplay calculations={calculations} isCalculating={isCalculating} />
                      </div>
                    )}
                    
                    {materialStatus.ingredients && formulaId && (
                      <div className="pt-4">
                        <MaterialStatusCard 
                          materialStatus={materialStatus}
                          selectedBottleId={selectedBottleId}
                          selectedCapId={selectedCapId}
                          selectedLabelId={selectedLabelId}
                          onBottleSelect={setSelectedBottleId}
                          onCapSelect={setSelectedCapId}
                          onLabelSelect={setSelectedLabelId}
                        />
                      </div>
                    )}
                    
                    <Button
                      onClick={handleAddLineItem}
                      disabled={!formulaId || bottlesOrdered <= 0}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {editingIndex !== null ? 'Update Line Item' : 'Add to Cart'}
                    </Button>
                    
                    {editingIndex !== null && (
                      <Button
                        onClick={() => { setEditingIndex(null); resetCurrentLineItem(); }}
                        variant="ghost"
                        className="w-full"
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
            
            {/* Order Cart */}
            {lineItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Cart ({lineItems.length} product{lineItems.length !== 1 ? 's' : ''})</CardTitle>
                  <CardDescription>Total bottles: {totalBottlesInCart.toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{item.formulaCode} — {item.formulaName}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {item.bottlesOrdered.toLocaleString()} bottles × {item.bottleSize} ct
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button size="sm" variant="ghost" onClick={() => handleEditLineItem(index)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveLineItem(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Notes Section — Collapsible, starts closed */}
            <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <CardTitle>Order Notes</CardTitle>
                          <CardDescription>Additional information or special instructions</CardDescription>
                        </div>
                      </div>
                      <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", notesOpen && "rotate-180")} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter any notes or special instructions..."
                      rows={4}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
            
            {/* Sticky Create Order Button */}
            <div className="sticky bottom-0 bg-background py-4 z-10 border-t">
              <Button
                onClick={handleCreateOrder}
                disabled={isSaving}
                size="lg"
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Order...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Create Order
                  </>
                )}
              </Button>
            </div>
          </>
        )}
        
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <OrdersListTab onSelectOrder={setSelectedOrderForDetail} />
        </TabsContent>
      </Tabs>
      </div>
      
      {/* Modals */}
      <ScheduleNewBatchModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
        onSuccess={handleScheduleSuccess}
        orderId={createdOrderId}
      />
      
      <MaterialReservationModal
        open={showReservationModal}
        onOpenChange={setShowReservationModal}
        orderId={createdOrderId}
        orderNumber={createdOrderNumber}
        scheduleItemIds={scheduleItemIds}
        onSuccess={handleReservationSuccess}
      />

      {/* Replace Order Confirmation Dialog */}
      <AlertDialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Existing Order?</AlertDialogTitle>
            <AlertDialogDescription>
              An order with PO number <strong>{existingOrderToReplace?.po_number}</strong> already exists.
              {existingOrderToReplace && (
                <div className="mt-2 space-y-1 text-sm">
                  <div>Order Number: <strong>{existingOrderToReplace.order_number}</strong></div>
                  <div>Status: <strong>{existingOrderToReplace.header_status}</strong></div>
                  <div>Created: <strong>{existingOrderToReplace.created_at ? formatET(existingOrderToReplace.created_at, 'MMM dd, yyyy hh:mm a') : 'Unknown'}</strong></div>
                </div>
              )}
              <div className="mt-3 text-destructive font-medium">
                Do you want to delete the old order and create this new one? This action cannot be undone.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReplaceOrder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Replace Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrderDetailModal 
        orderId={selectedOrderForDetail} 
        onClose={() => setSelectedOrderForDetail(null)} 
      />

      {draftPdfPath && (
        <POScanReviewModal
          isOpen={scanModalOpen}
          onClose={() => setScanModalOpen(false)}
          pdfPath={draftPdfPath}
          poNumber={poNumber || null}
          mode="prefill-form"
          customerId={customerId || null}
          onPrefill={handlePrefillFromScan}
        />
      )}
    </div>
  );
}
