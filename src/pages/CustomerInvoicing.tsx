import React, { useState, useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Download, Plus, DollarSign, Clock, CheckCircle, AlertCircle, Send } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { useOrderHeaders } from "@/hooks/useOrderHeaders";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatET } from "@/utils/dateUtils";

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  orderId?: string;
  orderNumber?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'partial';
  items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  dueDate: string;
  createdAt: string;
  notes?: string;
  paidAmount: number;
}

// Sample invoices for demonstration
const sampleInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    customerId: '1',
    customerName: 'Acme Health Products',
    orderId: 'order-1',
    orderNumber: 'ORD-2024-001',
    status: 'paid',
    items: [
      { id: '1', description: 'Vitamin D3 Gummies (60ct) - 5000 bottles', quantity: 5000, unitPrice: 2.50, total: 12500 },
      { id: '2', description: 'Shipping & Handling', quantity: 1, unitPrice: 350, total: 350 }
    ],
    subtotal: 12850,
    tax: 0,
    total: 12850,
    dueDate: '2024-01-15',
    createdAt: '2024-01-01',
    paidAmount: 12850
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    customerId: '2',
    customerName: 'Natural Wellness Co',
    status: 'sent',
    items: [
      { id: '1', description: 'Elderberry Immunity Gummies (90ct) - 3000 bottles', quantity: 3000, unitPrice: 3.25, total: 9750 }
    ],
    subtotal: 9750,
    tax: 0,
    total: 9750,
    dueDate: '2024-02-15',
    createdAt: '2024-01-20',
    paidAmount: 0
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-003',
    customerId: '3',
    customerName: 'Premium Supplements Inc',
    status: 'partial',
    items: [
      { id: '1', description: 'Multivitamin Gummies (120ct) - 10000 bottles', quantity: 10000, unitPrice: 4.00, total: 40000 }
    ],
    subtotal: 40000,
    tax: 0,
    total: 40000,
    dueDate: '2024-02-01',
    createdAt: '2024-01-10',
    paidAmount: 20000
  }
];

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  partial: { label: 'Partial', color: 'bg-yellow-100 text-yellow-700', icon: Clock }
};

export default function CustomerInvoicing() {
  const { customers, isLoading: customersLoading } = useCustomers();
  const { orders, isLoading: ordersLoading } = useOrderHeaders();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>(sampleInvoices);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // New invoice form state
  const [newInvoice, setNewInvoice] = useState({
    customerId: '',
    orderId: '',
    dueDate: formatET(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    notes: '',
    items: [] as InvoiceLineItem[]
  });

  const [newItem, setNewItem] = useState({
    description: '',
    quantity: 1,
    unitPrice: 0
  });

  const filteredInvoices = useMemo(() => {
    if (activeTab === 'all') return invoices;
    return invoices.filter(inv => inv.status === activeTab);
  }, [invoices, activeTab]);

  const stats = useMemo(() => {
    const total = invoices.reduce((acc, inv) => acc + inv.total, 0);
    const paid = invoices.filter(i => i.status === 'paid').reduce((acc, inv) => acc + inv.total, 0);
    const outstanding = invoices.filter(i => i.status !== 'paid').reduce((acc, inv) => acc + (inv.total - inv.paidAmount), 0);
    const overdue = invoices.filter(i => i.status === 'overdue').reduce((acc, inv) => acc + (inv.total - inv.paidAmount), 0);
    return { total, paid, outstanding, overdue };
  }, [invoices]);

  const handleAddItem = () => {
    if (!newItem.description || newItem.quantity <= 0) return;
    
    const item: InvoiceLineItem = {
      id: crypto.randomUUID(),
      description: newItem.description,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      total: newItem.quantity * newItem.unitPrice
    };

    setNewInvoice(prev => ({
      ...prev,
      items: [...prev.items, item]
    }));

    setNewItem({ description: '', quantity: 1, unitPrice: 0 });
  };

  const handleCreateInvoice = () => {
    if (!newInvoice.customerId || newInvoice.items.length === 0) {
      toast({ title: "Please select a customer and add items", variant: "destructive" });
      return;
    }

    const customer = customers.find(c => c.id === newInvoice.customerId);
    const order = orders?.find(o => o.id === newInvoice.orderId);
    const subtotal = newInvoice.items.reduce((acc, item) => acc + item.total, 0);

    const invoice: Invoice = {
      id: crypto.randomUUID(),
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`,
      customerId: newInvoice.customerId,
      customerName: customer?.company_name || 'Unknown',
      orderId: newInvoice.orderId || undefined,
      orderNumber: order?.order_number,
      status: 'draft',
      items: newInvoice.items,
      subtotal,
      tax: 0,
      total: subtotal,
      dueDate: newInvoice.dueDate,
      createdAt: formatET(new Date(), 'yyyy-MM-dd'),
      notes: newInvoice.notes,
      paidAmount: 0
    };

    setInvoices([invoice, ...invoices]);
    setIsCreateOpen(false);
    setNewInvoice({
      customerId: '',
      orderId: '',
      dueDate: formatET(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      notes: '',
      items: []
    });

    toast({ title: "Invoice created successfully" });
  };

  const generateInvoicePDF = (invoice: Invoice) => {
    const doc = new jsPDF();
    const customer = customers.find(c => c.id === invoice.customerId);

    // Header
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 20, 25);

    // Invoice details
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 20, 40);
    doc.text(`Date: ${formatET(invoice.createdAt, 'MMM dd, yyyy')}`, 20, 47);
    doc.text(`Due Date: ${formatET(invoice.dueDate, 'MMM dd, yyyy')}`, 20, 54);
    if (invoice.orderNumber) {
      doc.text(`Order #: ${invoice.orderNumber}`, 20, 61);
    }

    // Company info
    doc.setFont("helvetica", "bold");
    doc.text("From:", 130, 40);
    doc.setFont("helvetica", "normal");
    doc.text("ERP.ai Manufacturing", 130, 47);
    doc.text("123 Manufacturing Way", 130, 54);
    doc.text("Industry City, ST 12345", 130, 61);

    // Customer info
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 20, 80);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.customerName, 20, 87);
    if (customer?.contact_person) doc.text(customer.contact_person, 20, 94);
    if (customer?.email) doc.text(customer.email, 20, 101);

    // Status badge
    const statusLabel = statusConfig[invoice.status].label.toUpperCase();
    doc.setFillColor(invoice.status === 'paid' ? 34 : invoice.status === 'overdue' ? 220 : 59, 
                     invoice.status === 'paid' ? 197 : invoice.status === 'overdue' ? 53 : 130, 
                     invoice.status === 'paid' ? 94 : invoice.status === 'overdue' ? 69 : 246);
    doc.roundedRect(150, 75, 40, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(statusLabel, 170, 81, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    // Items table
    autoTable(doc, {
      startY: 115,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: invoice.items.map(item => [
        item.description,
        item.quantity.toString(),
        `$${item.unitPrice.toFixed(2)}`,
        `$${item.total.toFixed(2)}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [0, 123, 131] }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "normal");
    doc.text(`Subtotal: $${invoice.subtotal.toFixed(2)}`, 150, finalY, { align: 'right' });
    doc.text(`Tax: $${invoice.tax.toFixed(2)}`, 150, finalY + 7, { align: 'right' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Total: $${invoice.total.toFixed(2)}`, 150, finalY + 17, { align: 'right' });

    if (invoice.paidAmount > 0 && invoice.paidAmount < invoice.total) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Paid: $${invoice.paidAmount.toFixed(2)}`, 150, finalY + 27, { align: 'right' });
      doc.setFont("helvetica", "bold");
      doc.text(`Balance Due: $${(invoice.total - invoice.paidAmount).toFixed(2)}`, 150, finalY + 37, { align: 'right' });
    }

    // Notes
    if (invoice.notes) {
      const notesY = finalY + 50;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", 20, notesY);
      doc.setFont("helvetica", "normal");
      doc.text(invoice.notes, 20, notesY + 7);
    }

    // Payment info
    const paymentY = finalY + 70;
    doc.setFont("helvetica", "bold");
    doc.text("Payment Instructions:", 20, paymentY);
    doc.setFont("helvetica", "normal");
    doc.text("Bank: First National Bank", 20, paymentY + 8);
    doc.text("Account: 1234567890", 20, paymentY + 15);
    doc.text("Routing: 987654321", 20, paymentY + 22);

    doc.save(`Invoice_${invoice.invoiceNumber}.pdf`);
    toast({ title: "Invoice PDF generated" });
  };

  const handleMarkAsSent = (id: string) => {
    setInvoices(invoices.map(inv => 
      inv.id === id ? { ...inv, status: 'sent' as const } : inv
    ));
    toast({ title: "Invoice marked as sent" });
  };

  const handleMarkAsPaid = (id: string) => {
    setInvoices(invoices.map(inv => 
      inv.id === id ? { ...inv, status: 'paid' as const, paidAmount: inv.total } : inv
    ));
    toast({ title: "Invoice marked as paid" });
  };

  if (customersLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 space-y-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customer Invoicing</h1>
            <p className="text-muted-foreground">Create and manage customer invoices</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="[--dialog-max-width:42rem] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer *</Label>
                    <Select 
                      value={newInvoice.customerId} 
                      onValueChange={(v) => setNewInvoice(prev => ({ ...prev, customerId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input 
                      type="date" 
                      value={newInvoice.dueDate}
                      onChange={(e) => setNewInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Link to Order (optional)</Label>
                  <Select 
                    value={newInvoice.orderId} 
                    onValueChange={(v) => setNewInvoice(prev => ({ ...prev, orderId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {orders?.filter(o => o.customer_id === newInvoice.customerId).map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Add Item */}
                <div>
                  <Label className="text-sm font-medium">Add Line Item</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <Input 
                      placeholder="Description" 
                      className="col-span-2"
                      value={newItem.description}
                      onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                    />
                    <Input 
                      type="number" 
                      placeholder="Qty"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    />
                    <Input 
                      type="number" 
                      placeholder="Price"
                      value={newItem.unitPrice || ''}
                      onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <Button variant="outline" size="sm" className="mt-2" onClick={handleAddItem}>
                    Add Item
                  </Button>
                </div>

                {/* Items List */}
                {newInvoice.items.length > 0 && (
                  <div className="border rounded-lg p-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {newInvoice.items.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${item.total.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={3} className="text-right font-medium">Total:</TableCell>
                          <TableCell className="text-right font-bold">
                            ${newInvoice.items.reduce((acc, i) => acc + i.total, 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div>
                  <Label>Notes</Label>
                  <Textarea 
                    placeholder="Additional notes..."
                    value={newInvoice.notes}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <Button onClick={handleCreateInvoice} className="w-full">
                  Create Invoice
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Invoiced</CardDescription>
              <CardTitle className="text-2xl">${stats.total.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Paid</CardDescription>
              <CardTitle className="text-2xl text-green-600">${stats.paid.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Outstanding</CardDescription>
              <CardTitle className="text-2xl text-blue-600">${stats.outstanding.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Overdue</CardDescription>
              <CardTitle className="text-2xl text-red-600">${stats.overdue.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All ({invoices.length})</TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="sent">Sent</TabsTrigger>
                <TabsTrigger value="partial">Partial</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="overdue">Overdue</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map(invoice => {
                  const StatusIcon = statusConfig[invoice.status].icon;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.customerName}</TableCell>
                      <TableCell>{invoice.orderNumber || '-'}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig[invoice.status].color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[invoice.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">${invoice.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${invoice.paidAmount.toLocaleString()}</TableCell>
                      <TableCell>{formatET(invoice.dueDate, 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => generateInvoicePDF(invoice)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {invoice.status === 'draft' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleMarkAsSent(invoice.id)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          {invoice.status !== 'paid' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleMarkAsPaid(invoice.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
    </div>
  );
}
