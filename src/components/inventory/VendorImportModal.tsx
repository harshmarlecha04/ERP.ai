import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { parseVendorFile, ParsedVendor } from '@/utils/vendorFileParser';
import { useVendors } from '@/hooks/useVendors';
import { useToast } from '@/hooks/use-toast';

interface VendorImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  duplicates: string[];
}

export function VendorImportModal({ isOpen, onClose }: VendorImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedVendors, setParsedVendors] = useState<ParsedVendor[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createVendor, vendors, refetch } = useVendors();
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedVendors([]);
      setImportResult(null);
      setProgress(0);
    }
  };

  const handleParseFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(10);

    try {
      const vendors = await parseVendorFile(file);
      setParsedVendors(vendors);
      setProgress(50);
      
      toast({
        title: "File Parsed Successfully",
        description: `Found ${vendors.length} vendors in the file`,
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

  const handleImportVendors = async () => {
    if (parsedVendors.length === 0) return;

    console.log('Starting vendor import process...', {
      totalVendors: parsedVendors.length,
      existingVendors: vendors.length
    });

    setIsProcessing(true);
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      duplicates: []
    };

    const existingVendorNames = new Set(vendors.map(v => v.name.toLowerCase()));
    console.log('Existing vendor names:', Array.from(existingVendorNames));

    for (let i = 0; i < parsedVendors.length; i++) {
      const vendor = parsedVendors[i];
      setProgress(((i + 1) / parsedVendors.length) * 100);

      console.log(`Processing vendor ${i + 1}/${parsedVendors.length}:`, {
        name: vendor.name,
        emails: vendor.emails,
        phoneNumbers: vendor.phone_numbers,
        contactInfo: vendor.contact_info,
        notes: vendor.notes,
        vettingLink: vendor.vetting_link
      });

      try {
        // Check for duplicates
        if (existingVendorNames.has(vendor.name.toLowerCase())) {
          console.log(`Skipping duplicate vendor: ${vendor.name}`);
          result.duplicates.push(vendor.name);
          continue;
        }

        // Validate vendor data before creating
        if (!vendor.name || vendor.name.trim() === '') {
          throw new Error('Vendor name is required');
        }

        // Prepare vendor data with validation
        const vendorData = {
          name: vendor.name.trim(),
          contact_info: vendor.contact_info || null,
          emails: vendor.emails || [],
          phone_numbers: vendor.phone_numbers || [],
          notes: vendor.notes || null,
          vetting_link: vendor.vetting_link || null,
          address: vendor.address || null
        };

        console.log('Creating vendor with data:', vendorData);
        console.log('Original parsed vendor address:', vendor.address);
        
        // Validation check
        if (!vendor.address) {
          console.warn('Address field is missing or empty for vendor:', vendor.name);
        }

        await createVendor(vendorData);

        console.log(`Successfully created vendor: ${vendor.name}`);
        result.success++;
        existingVendorNames.add(vendor.name.toLowerCase());
      } catch (error) {
        console.error(`Failed to create vendor "${vendor.name}":`, error);
        result.failed++;
        
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          errorMessage = JSON.stringify(error);
        }
        
        result.errors.push(`${vendor.name}: ${errorMessage}`);
      }
    }

    console.log('Import completed:', result);

    setImportResult(result);
    setIsProcessing(false);
    setProgress(0);

    // Refresh the vendor list after import
    if (result.success > 0) {
      console.log('Refreshing vendor list after successful imports...');
      await refetch();
    }

    toast({
      title: "Import Complete",
      description: `Successfully imported ${result.success} vendors${result.failed > 0 ? `, ${result.failed} failed` : ''}${result.duplicates.length > 0 ? `, ${result.duplicates.length} duplicates` : ''}`,
      variant: result.success > 0 ? "default" : "destructive",
    });
  };

  const handleClose = () => {
    setFile(null);
    setParsedVendors([]);
    setImportResult(null);
    setProgress(0);
    setIsProcessing(false);
    onClose();
  };

  const getSupportedFormats = () => [
    "Excel files (.xlsx, .xls)",
    "CSV files (.csv)",
    "TSV files (.tsv)", 
    "JSON files (.json)"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Vendors</DialogTitle>
          <DialogDescription>
            Upload a file to import vendor information. Supported formats: Excel, CSV, TSV, JSON
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <div className="mt-4">
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  Choose File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.json"
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

          {/* Supported Formats */}
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Supported formats:</p>
            <ul className="list-disc list-inside space-y-1">
              {getSupportedFormats().map((format, index) => (
                <li key={index}>{format}</li>
              ))}
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
          {file && !parsedVendors.length && !importResult && (
            <Button 
              onClick={handleParseFile} 
              disabled={isProcessing}
              className="w-full"
            >
              Parse File
            </Button>
          )}

          {/* Parsed Vendors Preview */}
          {parsedVendors.length > 0 && !importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Found {parsedVendors.length} vendors
                </h3>
                <Button 
                  onClick={handleImportVendors}
                  disabled={isProcessing}
                >
                  Import All
                </Button>
              </div>
              
              <ScrollArea className="h-64 border rounded-md">
                <div className="p-4 space-y-3">
                  {parsedVendors.slice(0, 10).map((vendor, index) => (
                    <div key={index} className="border-b pb-2 last:border-b-0">
                      <div className="font-medium">{vendor.name}</div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {vendor.emails.length > 0 && (
                          <div>Emails: {vendor.emails.map(e => e.value).join(', ')}</div>
                        )}
                        {vendor.phone_numbers.length > 0 && (
                          <div>Phones: {vendor.phone_numbers.map(p => p.value).join(', ')}</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {parsedVendors.length > 10 && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      ... and {parsedVendors.length - 10} more vendors
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
                    <div className="text-sm text-muted-foreground">Successful</div>
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
                    <div className="font-medium">{importResult.duplicates.length}</div>
                    <div className="text-sm text-muted-foreground">Duplicates</div>
                  </div>
                </div>
              </div>

              {(importResult.errors.length > 0 || importResult.duplicates.length > 0) && (
                <ScrollArea className="h-32 border rounded-md p-4">
                  <div className="space-y-2">
                    {importResult.duplicates.length > 0 && (
                      <div>
                        <Badge variant="outline" className="mb-2">Duplicates Skipped</Badge>
                        {importResult.duplicates.map((name, index) => (
                          <div key={index} className="text-sm text-yellow-600">
                            {name} (already exists)
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {importResult.errors.length > 0 && (
                      <div>
                        <Badge variant="destructive" className="mb-2">Errors</Badge>
                        {importResult.errors.map((error, index) => (
                          <div key={index} className="text-sm text-red-600">
                            {error}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}