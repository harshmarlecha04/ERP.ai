import React, { useState, useMemo, useEffect } from "react";
import { Plus, Building2, Package2, DollarSign, Eye, Edit2, Save, X, Trash2, ExternalLink, Search, ArrowUpDown, CheckSquare, Square, Trash, Upload, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useRawMaterialsOptimized } from "@/hooks/useRawMaterialsOptimized";
import { ContactArrayInput } from '@/components/ui/contact-array-input';
import { useVendors, CreateVendorData, ContactItem } from '@/hooks/useVendors';
import type { Vendor } from '@/hooks/useVendors';
import { useAuth } from "@/hooks/useAuth";
import { DeleteConfirmationModal } from "@/components/inventory/DeleteConfirmationModal";
import { VendorImportModal } from "@/components/inventory/VendorImportModal";
import { VendorPOHistory } from "@/components/purchase-orders/VendorPOHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Fuse from 'fuse.js';

interface VendorSummary {
  name: string;
  totalMaterials: number;
  totalQuantity: number;
  totalSpend: number;
  materials: Array<{
    partNumber: string;
    materialName: string;
    totalQuantity: number;
    totalCost: number;
    lots: Array<{
      lotNumber: string;
      quantity: number;
      cost: number;
      expiryDate: string;
    }>;
  }>;
}

  interface NewVendorForm {
    name: string;
    contactInfo: string;
    emails: ContactItem[];
    phoneNumbers: ContactItem[];
    notes: string;
    vettingLink: string;
    address: string;
  }

export default function Vendor() {
  const { vendors, loading, createVendor, updateVendor, deleteVendor } = useVendors();
  const { materials: rawMaterialsData, isLoading: materialsLoading } = useRawMaterialsOptimized({});
  const { canAccessCosts, canAccessSuppliers, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedVendor, setSelectedVendor] = useState<VendorSummary | null>(null);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [isEditVendorOpen, setIsEditVendorOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteVendorData, setDeleteVendorData] = useState<{ id: string; name: string } | null>(null);
  const [newVendor, setNewVendor] = useState<NewVendorForm>({
    name: "",
    contactInfo: "",
    emails: [],
    phoneNumbers: [],
    notes: "",
    vettingLink: "",
    address: ""
  });
  const [editVendorData, setEditVendorData] = useState<NewVendorForm>({
    name: "",
    contactInfo: "",
    emails: [],
    phoneNumbers: [],
    notes: "",
    vettingLink: "",
    address: ""
  });

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recently_updated");
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(new Set());
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isDeleteSelectedOpen, setIsDeleteSelectedOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Calculate vendor summaries from raw materials data
  const vendorSummaries = useMemo(() => {
    if (!rawMaterialsData || rawMaterialsData.length === 0) return [];
    
    const vendorMap = new Map<string, VendorSummary>();

    rawMaterialsData.forEach(material => {
      const vendorName = material.supplier || 'Unknown Supplier';
      
      if (!vendorMap.has(vendorName)) {
        vendorMap.set(vendorName, {
          name: vendorName,
          totalMaterials: 0,
          totalQuantity: 0,
          totalSpend: 0,
          materials: []
        });
      }

      const vendor = vendorMap.get(vendorName)!;
      
      // Calculate material totals from lots
      const materialQuantity = material.lots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);
      const materialCost = material.lots.reduce((sum, lot) => sum + (lot.quantity || 0) * (lot.cost || 0), 0);

      // Add to vendor totals
      vendor.totalMaterials += 1;
      vendor.totalQuantity += materialQuantity;
      vendor.totalSpend += materialCost;

      // Add material details
      vendor.materials.push({
        partNumber: material.code,
        materialName: material.name,
        totalQuantity: materialQuantity,
        totalCost: materialCost,
        lots: material.lots.map(lot => ({
          lotNumber: lot.lot_number || 'N/A',
          quantity: lot.quantity || 0,
          cost: (lot.quantity || 0) * (lot.cost || 0),
          expiryDate: lot.expires_on || 'N/A'
        }))
      });
    });

    return Array.from(vendorMap.values()).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [rawMaterialsData]);

  // Enhanced search and filter logic
  const filteredAndSortedVendors = useMemo(() => {
    let result = [...vendors];

    // Search filtering
    if (searchQuery.trim()) {
      const fuse = new Fuse(vendors, {
        keys: [
          { name: 'name', weight: 0.4 },
          { name: 'contact_info', weight: 0.3 },
          { name: 'notes', weight: 0.2 }
        ],
        threshold: 0.4,
        includeScore: true
      });

      // Get materials for each vendor for material-based search
      const vendorsWithMaterials = vendors.map(vendor => {
        const summary = vendorSummaries.find(s => s.name === vendor.name);
        return {
          ...vendor,
          materialNames: summary?.materials.map(m => m.materialName).join(' ') || ''
        };
      });

      // Search in material names too
      const materialFuse = new Fuse(vendorsWithMaterials, {
        keys: [
          { name: 'materialNames', weight: 0.5 }
        ],
        threshold: 0.3,
        includeScore: true
      });

      const basicResults = fuse.search(searchQuery).map(result => ({ ...result.item, score: result.score || 0 }));
      const materialResults = materialFuse.search(searchQuery).map(result => ({ ...result.item, score: result.score || 0 }));

      // Combine and deduplicate results
      const combinedResults = new Map();
      [...basicResults, ...materialResults].forEach(vendor => {
        const existing = combinedResults.get(vendor.id);
        if (!existing || vendor.score < existing.score) {
          combinedResults.set(vendor.id, vendor);
        }
      });

      result = Array.from(combinedResults.values()).sort((a, b) => a.score - b.score);
    }

    // Sorting
    result.sort((a, b) => {
      const summaryA = vendorSummaries.find(s => s.name === a.name);
      const summaryB = vendorSummaries.find(s => s.name === b.name);

      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'materials_desc':
          return (summaryB?.totalMaterials || 0) - (summaryA?.totalMaterials || 0);
        case 'materials_asc':
          return (summaryA?.totalMaterials || 0) - (summaryB?.totalMaterials || 0);
        case 'cost_desc':
          return (summaryB?.totalSpend || 0) - (summaryA?.totalSpend || 0);
        case 'cost_asc':
          return (summaryA?.totalSpend || 0) - (summaryB?.totalSpend || 0);
        case 'recently_updated':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return result;
  }, [vendors, vendorSummaries, searchQuery, sortBy]);

  const validateDropboxLink = (link: string): boolean => {
    if (!link) return true; // Optional field
    return link.includes('dropbox.com') || link.includes('drive.google.com');
  };

  const handleAddVendor = async () => {
    if (!newVendor.name.trim()) return;
    
    if (newVendor.vettingLink && !validateDropboxLink(newVendor.vettingLink)) {
      alert("Please enter a valid Dropbox or Google Drive link");
      return;
    }

    try {
      const vendorData: CreateVendorData = {
        name: newVendor.name.trim(),
        contact_info: newVendor.contactInfo.trim() || undefined,
        emails: newVendor.emails.length > 0 ? newVendor.emails : undefined,
        phone_numbers: newVendor.phoneNumbers.length > 0 ? newVendor.phoneNumbers : undefined,
        notes: newVendor.notes.trim() || undefined,
        vetting_link: newVendor.vettingLink.trim() || undefined,
        address: newVendor.address.trim() || undefined,
      };

      await createVendor(vendorData);
      setNewVendor({ name: "", contactInfo: "", emails: [], phoneNumbers: [], notes: "", vettingLink: "", address: "" });
      setIsAddVendorOpen(false);
    } catch (error) {
      console.error("Failed to add vendor:", error);
    }
  };

  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setEditVendorData({
      name: vendor.name,
      contactInfo: vendor.contact_info || "",
      emails: vendor.emails || [],
      phoneNumbers: vendor.phone_numbers || [],
      notes: vendor.notes || "",
      vettingLink: vendor.vetting_link || "",
      address: vendor.address || ""
    });
    setIsEditVendorOpen(true);
  };

  const handleSaveVendorEdit = async () => {
    if (!editingVendor || !editVendorData.name.trim()) return;
    
    if (editVendorData.vettingLink && !validateDropboxLink(editVendorData.vettingLink)) {
      alert("Please enter a valid Dropbox or Google Drive link");
      return;
    }

    try {
      const vendorData: Partial<CreateVendorData> = {
        name: editVendorData.name.trim(),
        contact_info: editVendorData.contactInfo.trim() || undefined,
        emails: editVendorData.emails.length > 0 ? editVendorData.emails : undefined,
        phone_numbers: editVendorData.phoneNumbers.length > 0 ? editVendorData.phoneNumbers : undefined,
        notes: editVendorData.notes.trim() || undefined,
        vetting_link: editVendorData.vettingLink.trim() || undefined,
        address: editVendorData.address.trim() || undefined,
      };

      await updateVendor(editingVendor.id, vendorData);
      setEditingVendor(null);
      setEditVendorData({ name: "", contactInfo: "", emails: [], phoneNumbers: [], notes: "", vettingLink: "", address: "" });
      setIsEditVendorOpen(false);
    } catch (error) {
      console.error("Failed to update vendor:", error);
    }
  };

  const handleDeleteVendor = async () => {
    if (!deleteVendorData) return;
    
    try {
      await deleteVendor(deleteVendorData.id);
      setDeleteVendorData(null);
      setSelectedVendorIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(deleteVendorData.id);
        return newSet;
      });
    } catch (error) {
      console.error("Failed to delete vendor:", error);
    }
  };

  // Multi-select handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVendorIds(new Set(filteredAndSortedVendors.map(v => v.id)));
    } else {
      setSelectedVendorIds(new Set());
    }
  };

  const handleSelectVendor = (vendorId: string, checked: boolean) => {
    setSelectedVendorIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(vendorId);
      } else {
        newSet.delete(vendorId);
      }
      return newSet;
    });
  };

  // Bulk delete handlers
  const handleDeleteSelected = async () => {
    try {
      const promises = Array.from(selectedVendorIds).map(id => deleteVendor(id));
      await Promise.all(promises);
      setSelectedVendorIds(new Set());
      setIsDeleteSelectedOpen(false);
    } catch (error) {
      console.error("Failed to delete selected vendors:", error);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const promises = vendors.map(vendor => deleteVendor(vendor.id));
      await Promise.all(promises);
      setSelectedVendorIds(new Set());
      setIsDeleteAllOpen(false);
    } catch (error) {
      console.error("Failed to delete all vendors:", error);
    }
  };


  const openVettingLink = (link: string) => {
    window.open(link, '_blank');
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: `${label} copied successfully`,
      });
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast({
        title: "Copied to clipboard",
        description: `${label} copied successfully`,
      });
    }
  };


  // Check if user has access to supplier information
  if (!user) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center py-12">Please log in to access supplier information.</div>
        </div>
      </div>
    );
  }

  if (!canAccessSuppliers()) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <Building2 className="h-5 w-5" />
                Supplier Access Restricted
              </CardTitle>
              <CardDescription>
                Access to supplier contact information is restricted to protect vendor privacy and prevent competitive intelligence gathering.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Enhanced Security Policy</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  To prevent data harvesting and protect vendor relationships, supplier contact information is restricted to:
                </p>
                <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  <li><strong>Administrators</strong> - Full access to all supplier data and contact information</li>
                  <li><strong>Production Managers</strong> - Access for procurement, vendor management, and supply chain operations</li>
                  <li><strong>HR Managers</strong> - Access for vendor relationship management and contract administration</li>
                </ul>
                <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/30 rounded border border-amber-300 dark:border-amber-700">
                  <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                    <strong>Security Notice:</strong> This restriction prevents unauthorized access to vendor emails, phone numbers, 
                    and addresses which could be used for spam, phishing attacks, or competitive intelligence gathering.
                  </p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">
                  Contact your administrator to request supplier access if needed for your role.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vendor Management</h1>
            <p className="text-muted-foreground">Manage and track all your vendors</p>
          </div>
          
          <div className="flex gap-2">
            <Dialog open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Vendor
                </Button>
              </DialogTrigger>
            
            <Button 
              variant="outline"
              onClick={() => setIsImportModalOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Vendors
            </Button>
            <DialogContent className="[--dialog-max-width:42rem] max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
                <DialogDescription>
                  Add a new vendor to your database
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 px-1">
                <div className="grid gap-6 py-4">
                  {/* Company Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Company Information</h3>
                    <div className="grid gap-2">
                      <Label htmlFor="vendor-name">Company Name *</Label>
                      <Input
                        id="vendor-name"
                        value={newVendor.name}
                        onChange={(e) => setNewVendor(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter company name"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vendor-address">Address</Label>
                      <Input
                        id="vendor-address"
                        value={newVendor.address}
                        onChange={(e) => setNewVendor(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Enter company address"
                      />
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Contact Details</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <ContactArrayInput
                        title="Email Addresses"
                        contacts={newVendor.emails}
                        onChange={(emails) => setNewVendor(prev => ({ ...prev, emails }))}
                        placeholder="email@company.com"
                        types={[
                          { value: 'primary', label: 'Primary' },
                          { value: 'billing', label: 'Billing' },
                          { value: 'support', label: 'Support' },
                          { value: 'other', label: 'Other' }
                        ]}
                      />
                      <ContactArrayInput
                        title="Phone Numbers"
                        contacts={newVendor.phoneNumbers}
                        onChange={(phoneNumbers) => setNewVendor(prev => ({ ...prev, phoneNumbers }))}
                        placeholder="+1 (555) 123-4567"
                        types={[
                          { value: 'office', label: 'Office' },
                          { value: 'mobile', label: 'Mobile' },
                          { value: 'fax', label: 'Fax' },
                          { value: 'other', label: 'Other' }
                        ]}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contact-info">Legacy Contact Info (Optional)</Label>
                      <Input
                        id="contact-info"
                        value={newVendor.contactInfo}
                        onChange={(e) => setNewVendor(prev => ({ ...prev, contactInfo: e.target.value }))}
                        placeholder="For backwards compatibility"
                      />
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Additional Information</h3>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          value={newVendor.notes}
                          onChange={(e) => setNewVendor(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Additional notes about vendor"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="vetting-link">COA Dropbox Link (Optional)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="vetting-link"
                            value={newVendor.vettingLink}
                            onChange={(e) => setNewVendor(prev => ({ ...prev, vettingLink: e.target.value }))}
                            placeholder="https://dropbox.com/... or https://drive.google.com/..."
                          />
                          {newVendor.vettingLink && validateDropboxLink(newVendor.vettingLink) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openVettingLink(newVendor.vettingLink)}
                              title="Preview link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {newVendor.vettingLink && !validateDropboxLink(newVendor.vettingLink) && (
                          <p className="text-sm text-destructive">Please enter a valid Dropbox or Google Drive link</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsAddVendorOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddVendor} disabled={!newVendor.name.trim()}>
                  Add Vendor
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search vendors by name, materials, or contact info..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recently_updated">Recently Updated</SelectItem>
                    <SelectItem value="name_asc">A-Z (by name)</SelectItem>
                    <SelectItem value="materials_desc">Materials: High to Low</SelectItem>
                    <SelectItem value="materials_asc">Materials: Low to High</SelectItem>
                    {canAccessCosts() && (
                      <>
                        <SelectItem value="cost_desc">Cost: High to Low</SelectItem>
                        <SelectItem value="cost_asc">Cost: Low to High</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedVendorIds.size > 0 && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">
                    {selectedVendorIds.size} vendor{selectedVendorIds.size > 1 ? 's' : ''} selected
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedVendorIds(new Set())}
                  >
                    Clear Selection
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsDeleteSelectedOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Trash className="h-4 w-4" />
                    Delete Selected
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vendor Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Vendor Overview
              </div>
              {vendors.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteAllOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Trash className="h-4 w-4" />
                  Delete All
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              All vendors with material and spending summaries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredAndSortedVendors.length > 0 && selectedVendorIds.size === filteredAndSortedVendors.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all vendors"
                      />
                    </TableHead>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead className="text-right">Materials Supplied</TableHead>
                    <TableHead className="text-right">Total Quantity</TableHead>
                    <TableHead className="text-right">
                      {canAccessCosts() ? "Total Spend" : "Cost Access"}
                    </TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedVendors.map((vendor) => {
                    const summary = vendorSummaries.find(s => s.name === vendor.name);
                    return (
                      <TableRow key={vendor.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedVendorIds.has(vendor.id)}
                            onCheckedChange={(checked) => handleSelectVendor(vendor.id, checked === true)}
                            aria-label={`Select ${vendor.name}`}
                          />
                        </TableCell>
                         <TableCell className="font-medium">
                           <button
                             onClick={() => summary && setSelectedVendor(summary)}
                             className="text-left text-primary hover:text-primary/80 transition-colors cursor-pointer underline decoration-transparent hover:decoration-current font-medium"
                             disabled={!summary}
                           >
                             {vendor.name}
                           </button>
                         </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Package2 className="h-4 w-4 text-muted-foreground" />
                            {summary?.totalMaterials || 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {summary?.totalQuantity.toLocaleString() || 0} kg
                        </TableCell>
                         <TableCell className="text-right">
                           {canAccessCosts() ? (
                             <div className="flex items-center justify-end gap-1">
                               <DollarSign className="h-4 w-4 text-muted-foreground" />
                               ${summary?.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                             </div>
                           ) : (
                             <span className="text-muted-foreground">Restricted</span>
                           )}
                         </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditVendor(vendor)}
                              title="Edit Vendor"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteVendorData({ id: vendor.id, name: vendor.name })}
                              title="Delete Vendor"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredAndSortedVendors.length === 0 && vendors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No vendors found. Add your first vendor to get started.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredAndSortedVendors.length === 0 && vendors.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No vendors match your search criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Vendor Detail Modal */}
        <Dialog open={!!selectedVendor} onOpenChange={() => setSelectedVendor(null)}>
          <DialogContent className="[--dialog-max-width:56rem] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {selectedVendor?.name}
              </DialogTitle>
              <DialogDescription>
                Detailed vendor information and material breakdown
              </DialogDescription>
            </DialogHeader>
            
            {selectedVendor && (
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="po-history">PO History</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  {/* Vendor Details Section */}
                  {(() => {
                    const vendorDetails = vendors.find(v => v.name === selectedVendor.name);
                    return vendorDetails && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Vendor Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {/* Email Addresses */}
                             {vendorDetails.emails && vendorDetails.emails.length > 0 && (
                               <div>
                                 <Label className="text-sm font-medium">Email Addresses</Label>
                                 <div className="mt-1 space-y-1">
                                   {vendorDetails.emails.map((email) => (
                                     <div key={email.id} className="flex items-center gap-2 text-sm">
                                       <a 
                                         href={`mailto:${email.value}`} 
                                         className="text-primary hover:underline"
                                       >
                                         {email.value}
                                       </a>
                                       <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">
                                         {email.type}
                                       </span>
                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         onClick={() => copyToClipboard(email.value, "Email")}
                                         className="h-6 w-6 p-0 hover:bg-muted"
                                       >
                                         <Copy className="h-3 w-3" />
                                       </Button>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}
                            
                             {/* Phone Numbers */}
                             {vendorDetails.phone_numbers && vendorDetails.phone_numbers.length > 0 && (
                               <div>
                                 <Label className="text-sm font-medium">Phone Numbers</Label>
                                 <div className="mt-1 space-y-1">
                                   {vendorDetails.phone_numbers.map((phone) => (
                                     <div key={phone.id} className="flex items-center gap-2 text-sm">
                                       <a 
                                         href={`tel:${phone.value}`} 
                                         className="text-primary hover:underline"
                                       >
                                         {phone.value}
                                       </a>
                                       <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">
                                         {phone.type}
                                       </span>
                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         onClick={() => copyToClipboard(phone.value, "Phone number")}
                                         className="h-6 w-6 p-0 hover:bg-muted"
                                       >
                                         <Copy className="h-3 w-3" />
                                       </Button>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}
                            
                            {/* Legacy Contact Info - only show if no structured contacts or has additional info */}
                            {vendorDetails.contact_info && (
                              (!vendorDetails.emails?.length && !vendorDetails.phone_numbers?.length) ||
                              (vendorDetails.contact_info && 
                               !vendorDetails.emails?.some(e => vendorDetails.contact_info?.includes(e.value)) &&
                               !vendorDetails.phone_numbers?.some(p => vendorDetails.contact_info?.includes(p.value)))
                            ) && (
                              <div>
                                <Label className="text-sm font-medium">Additional Contact Info</Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {vendorDetails.contact_info}
                                </p>
                              </div>
                            )}
                            
                            {/* Show fallback if no contact info at all */}
                            {!vendorDetails.emails?.length && 
                             !vendorDetails.phone_numbers?.length && 
                             !vendorDetails.contact_info && (
                              <div>
                                <Label className="text-sm font-medium">Contact Information</Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                  No contact information provided
                                </p>
                              </div>
                            )}
                            
                             {/* Address */}
                             <div>
                               <Label className="text-sm font-medium">Address</Label>
                               {vendorDetails.address ? (
                                 <div className="flex items-center gap-2 text-sm mt-1">
                                   <span className="text-muted-foreground">
                                     {vendorDetails.address}
                                   </span>
                                   <Button
                                     variant="ghost"
                                     size="sm"
                                     onClick={() => copyToClipboard(vendorDetails.address, "Address")}
                                     className="h-6 w-6 p-0 hover:bg-muted"
                                   >
                                     <Copy className="h-3 w-3" />
                                   </Button>
                                 </div>
                               ) : (
                                 <p className="text-sm text-muted-foreground mt-1">
                                   No address provided
                                 </p>
                               )}
                             </div>
                          </div>
                          {vendorDetails.notes && (
                            <div>
                              <Label className="text-sm font-medium">Notes</Label>
                              <p className="text-sm text-muted-foreground mt-1">{vendorDetails.notes}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{selectedVendor.totalMaterials}</div>
                        <p className="text-xs text-muted-foreground">Materials Supplied</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{selectedVendor.totalQuantity.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total Quantity</p>
                      </CardContent>
                    </Card>
                     <Card>
                       <CardContent className="pt-6">
                         <div className="text-2xl font-bold">
                           {canAccessCosts() ? 
                             `$${selectedVendor.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 
                             "Restricted"
                           }
                         </div>
                         <p className="text-xs text-muted-foreground">Total Spend</p>
                       </CardContent>
                     </Card>
                  </div>

                  {/* Materials Table */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Materials from {selectedVendor.name}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part Number</TableHead>
                          <TableHead>Material Name</TableHead>
                          <TableHead className="text-right">Total Quantity</TableHead>
                          <TableHead className="text-right">
                            {canAccessCosts() ? "Total Cost" : "Cost Access"}
                          </TableHead>
                          <TableHead className="text-right">Lots</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedVendor.materials.map((material) => (
                          <TableRow key={material.partNumber}>
                            <TableCell className="font-mono text-sm">{material.partNumber}</TableCell>
                            <TableCell>{material.materialName}</TableCell>
                            <TableCell className="text-right">{material.totalQuantity.toLocaleString()}</TableCell>
                             <TableCell className="text-right">
                               {canAccessCosts() ? 
                                 `$${material.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 
                                 "Restricted"
                               }
                             </TableCell>
                            <TableCell className="text-right">{material.lots.length}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="po-history">
                  <VendorPOHistory vendorName={selectedVendor.name} />
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Vendor Modal */}
        <Dialog open={isEditVendorOpen} onOpenChange={setIsEditVendorOpen}>
          <DialogContent className="[--dialog-max-width:42rem]">
            <DialogHeader>
              <DialogTitle>Edit Vendor</DialogTitle>
              <DialogDescription>
                Update vendor information
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Company Information</h3>
                <div className="grid gap-2">
                  <Label htmlFor="edit-vendor-name">Company Name *</Label>
                  <Input
                    id="edit-vendor-name"
                    value={editVendorData.name}
                    onChange={(e) => setEditVendorData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter company name"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-vendor-address">Address</Label>
                  <Input
                    id="edit-vendor-address"
                    value={editVendorData.address}
                    onChange={(e) => setEditVendorData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter company address"
                  />
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Contact Details</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <ContactArrayInput
                    title="Email Addresses"
                    contacts={editVendorData.emails}
                    onChange={(emails) => setEditVendorData(prev => ({ ...prev, emails }))}
                    placeholder="email@company.com"
                    types={[
                      { value: 'primary', label: 'Primary' },
                      { value: 'billing', label: 'Billing' },
                      { value: 'support', label: 'Support' },
                      { value: 'other', label: 'Other' }
                    ]}
                  />
                  <ContactArrayInput
                    title="Phone Numbers"
                    contacts={editVendorData.phoneNumbers}
                    onChange={(phoneNumbers) => setEditVendorData(prev => ({ ...prev, phoneNumbers }))}
                    placeholder="+1 (555) 123-4567"
                    types={[
                      { value: 'office', label: 'Office' },
                      { value: 'mobile', label: 'Mobile' },
                      { value: 'fax', label: 'Fax' },
                      { value: 'other', label: 'Other' }
                    ]}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-contact-info">Legacy Contact Info (Optional)</Label>
                  <Input
                    id="edit-contact-info"
                    value={editVendorData.contactInfo}
                    onChange={(e) => setEditVendorData(prev => ({ ...prev, contactInfo: e.target.value }))}
                    placeholder="For backwards compatibility"
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Additional Information</h3>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-notes">Notes (Optional)</Label>
                    <Textarea
                      id="edit-notes"
                      value={editVendorData.notes}
                      onChange={(e) => setEditVendorData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes about vendor"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-vetting-link">COA Dropbox Link (Optional)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="edit-vetting-link"
                        value={editVendorData.vettingLink}
                        onChange={(e) => setEditVendorData(prev => ({ ...prev, vettingLink: e.target.value }))}
                        placeholder="https://dropbox.com/... or https://drive.google.com/..."
                      />
                      {editVendorData.vettingLink && validateDropboxLink(editVendorData.vettingLink) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openVettingLink(editVendorData.vettingLink)}
                          title="Preview link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {editVendorData.vettingLink && !validateDropboxLink(editVendorData.vettingLink) && (
                      <p className="text-sm text-destructive">Please enter a valid Dropbox or Google Drive link</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditVendorOpen(false)}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button 
                onClick={handleSaveVendorEdit} 
                disabled={!editVendorData.name.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={!!deleteVendorData}
          onClose={() => setDeleteVendorData(null)}
          onConfirm={handleDeleteVendor}
          title="Delete Vendor"
          description={`Are you sure you want to delete ${deleteVendorData?.name}? This action cannot be undone.`}
        />

        {/* Delete Selected Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={isDeleteSelectedOpen}
          onClose={() => setIsDeleteSelectedOpen(false)}
          onConfirm={handleDeleteSelected}
          title="Delete Selected Vendors"
          description={`Are you sure you want to delete ${selectedVendorIds.size} selected vendor${selectedVendorIds.size > 1 ? 's' : ''}? This action cannot be undone.`}
        />

        {/* Delete All Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={isDeleteAllOpen}
          onClose={() => setIsDeleteAllOpen(false)}
          onConfirm={handleDeleteAll}
          title="Delete All Vendors"
          description={`Are you sure you want to delete all ${vendors.length} vendors? This action cannot be undone and will remove all vendor data.`}
        />

        {/* Vendor Import Modal */}
        <VendorImportModal 
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
        />
      </div>
    </div>
  );
}