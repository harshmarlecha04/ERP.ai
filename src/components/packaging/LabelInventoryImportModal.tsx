import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { parseLabelInventoryFile, ParsedLabelInventory } from '@/utils/labelInventoryParser';
import { useBulkCreateLabelInventory } from '@/hooks/useLabelInventory';
import { useCustomers } from '@/hooks/useCustomers';
import { useToast } from '@/hooks/use-toast';
import { todayET } from "@/utils/dateUtils";

interface LabelInventoryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export function LabelInventoryImportModal({ isOpen, onClose }: LabelInventoryImportModalProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedRecords, setParsedRecords] = useState<ParsedLabelInventory[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkCreate = useBulkCreateLabelInventory();
  const { customers } = useCustomers();
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedRecords([]);
      setImportResult(null);
      setProgress(0);
    }
  };

  const handleParseFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(10);

    try {
      const records = await parseLabelInventoryFile(file);
      setParsedRecords(records);
      setProgress(50);
      
      const validCount = records.filter(r => r.isValid).length;
      const invalidCount = records.filter(r => !r.isValid).length;
      
      toast({
        title: "File Parsed Successfully",
        description: `Found ${validCount} valid records${invalidCount > 0 ? ` and ${invalidCount} invalid` : ''}`,
      });
    } catch (error) {
      toast({
        title: "Parse Error",
        description: error instanceof Error ? error.message : "Failed to parse file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleImportRecords = async () => {
    const validRecords = parsedRecords.filter(r => r.isValid);
    if (validRecords.length === 0) return;

    if (!selectedCustomerId) {
      toast({
        title: "Customer Required",
        description: "Please select a customer before importing",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    try {
      // Get customer name for prefixing
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      const customerPrefix = selectedCustomer?.company_name || '';

      // Prepare records for bulk insert
      const today = todayET();
      const recordsToInsert = validRecords.map(record => ({
        customer_product: `${customerPrefix} - ${record.customer_product}`,
        date: today,
        received_qty: 0,
        used_qty: 0,
        on_hand: record.on_hand,
        source_sheet: `Import - ${file?.name || 'Excel'}`,
        customer_id: selectedCustomerId,
        product_name: record.customer_product,
      }));

      // Bulk insert
      setProgress(30);
      await bulkCreate.mutateAsync(recordsToInsert);
      
      result.success = recordsToInsert.length;
      result.skipped = parsedRecords.length - validRecords.length;
      setProgress(100);

      toast({
        title: "Import Complete",
        description: `Successfully imported ${result.success} records${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`,
      });
    } catch (error) {
      result.failed = validRecords.length;
      result.errors.push(error instanceof Error ? error.message : 'Import failed');
      
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import records",
        variant: "destructive",
      });
    } finally {
      setImportResult(result);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleClose = () => {
    setSelectedCustomerId('');
    setFile(null);
    setParsedRecords([]);
    setImportResult(null);
    setProgress(0);
    setIsProcessing(false);
    onClose();
  };

  const validRecords = parsedRecords.filter(r => r.isValid);
  const invalidRecords = parsedRecords.filter(r => !r.isValid);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Label Inventory</DialogTitle>
          <DialogDescription>
            Upload an Excel file to import current label inventory. This creates a snapshot of your current on-hand quantities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label htmlFor="customer-select">Select Customer *</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger id="customer-select">
                <SelectValue placeholder="Choose a customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Label names will be automatically prefixed with the customer name
            </p>
          </div>

          {/* File Upload Section */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <div className="mt-4">
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing || !selectedCustomerId}
                >
                  Choose Excel File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              {file && (
                <div className="mt-2 flex items-center justify-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Expected Format */}
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <p className="font-medium mb-1">Expected Excel format:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Column 1: Product/Label Name (without customer name)</li>
              <li>Column 2: On-Hand Quantity</li>
              <li>Column 3: Notes (optional)</li>
              <li>Customer name will be automatically added as prefix</li>
              <li>Category headers and empty rows will be skipped automatically</li>
            </ul>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Parse Button */}
          {file && !parsedRecords.length && !importResult && (
            <Button 
              onClick={handleParseFile} 
              disabled={isProcessing}
              className="w-full"
            >
              Parse File
            </Button>
          )}

          {/* Parsed Records Preview */}
          {parsedRecords.length > 0 && !importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    Found {validRecords.length} valid records
                  </h3>
                  {invalidRecords.length > 0 && (
                    <p className="text-sm text-yellow-600">
                      {invalidRecords.length} records have errors and will be skipped
                    </p>
                  )}
                  {validRecords.length === 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      ⚠️ No valid records found. Check your Excel format.
                    </p>
                  )}
                  {validRecords.length > 0 && selectedCustomerId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Labels will be prefixed with: {customers.find(c => c.id === selectedCustomerId)?.company_name}
                    </p>
                  )}
                </div>
                <Button 
                  onClick={handleImportRecords}
                  disabled={isProcessing || validRecords.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Import {validRecords.length} Records
                </Button>
              </div>
              
              <ScrollArea className="h-64 border rounded-md">
                <div className="p-4 space-y-2">
                  {parsedRecords.slice(0, 20).map((record, index) => (
                    <div 
                      key={index} 
                      className={`border-b pb-2 last:border-b-0 ${!record.isValid ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {selectedCustomerId && customers.find(c => c.id === selectedCustomerId)?.company_name && (
                              <span className="text-muted-foreground">
                                {customers.find(c => c.id === selectedCustomerId)?.company_name} - 
                              </span>
                            )}
                            {record.customer_product}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            On-hand: {record.on_hand}
                            {record.notes && ` • ${record.notes}`}
                          </div>
                        </div>
                        {record.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 ml-2" />
                        ) : (
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-xs text-red-500">{record.validationError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {parsedRecords.length > 20 && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      ... and {parsedRecords.length - 20} more records
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Import Results</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">{importResult.success}</div>
                    <div className="text-sm text-muted-foreground">Imported</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <div className="font-medium">{importResult.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <X className="h-5 w-5 text-yellow-500" />
                  <div>
                    <div className="font-medium">{importResult.skipped}</div>
                    <div className="text-sm text-muted-foreground">Skipped</div>
                  </div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <ScrollArea className="h-32 border rounded-md p-4">
                  <div className="space-y-2">
                    <Badge variant="destructive" className="mb-2">Errors</Badge>
                    {importResult.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600">
                        {error}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
