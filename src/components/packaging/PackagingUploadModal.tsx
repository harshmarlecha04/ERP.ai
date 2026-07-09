import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateItemsTemplate, generateMovementsTemplate } from "@/utils/packagingCsvExport";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PackagingUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadType: 'items' | 'movements';
}

interface ParsedItem {
  category: string;
  sku: string;
  name: string;
  on_hand: number;
  min_quantity?: number;
  unit_of_measure?: string;
}

interface ParsedMovement {
  packaging_item_id: string;
  movement_type: string;
  quantity: number;
  reference_number?: string;
  notes?: string;
}

export const PackagingUploadModal: React.FC<PackagingUploadModalProps> = ({
  open,
  onOpenChange,
  uploadType,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parseResults, setParseResults] = useState<{ success: number; errors: string[] } | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setParseResults(null);
    
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      setSelectedFile(file);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please select a CSV file.",
      });
    }
  };

  const parseAndValidateItems = (data: any[]): { valid: ParsedItem[]; errors: string[] } => {
    const valid: ParsedItem[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      const rowNum = index + 2; // Account for header row
      
      if (!row.category || !row.sku || !row.name) {
        errors.push(`Row ${rowNum}: Missing required field (category, sku, or name)`);
        return;
      }

      const onHand = parseFloat(row.on_hand || row.quantity || '0');
      if (isNaN(onHand) || onHand < 0) {
        errors.push(`Row ${rowNum}: Invalid quantity value`);
        return;
      }

      valid.push({
        category: row.category.toUpperCase(),
        sku: row.sku.trim(),
        name: row.name.trim(),
        on_hand: onHand,
        min_quantity: parseFloat(row.min_quantity) || 0,
        unit_of_measure: row.unit_of_measure || 'units',
      });
    });

    return { valid, errors };
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setParseResults(null);

    try {
      const text = await selectedFile.text();
      
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          if (uploadType === 'items') {
            const { valid, errors } = parseAndValidateItems(results.data);
            
            if (valid.length > 0) {
              // Upsert items - update if SKU exists, insert if new
              const { error: insertError } = await supabase
                .from('packaging_item')
                .upsert(
                  valid.map(item => ({
                    category: item.category,
                    sku: item.sku,
                    item_name: item.name,
                    on_hand: item.on_hand,
                    min_quantity: item.min_quantity,
                    unit_of_measure: item.unit_of_measure,
                  })) as any,
                  { onConflict: 'sku' }
                );

              if (insertError) {
                errors.push(`Database error: ${insertError.message}`);
              }
            }

            setParseResults({ success: valid.length, errors });
            
            if (valid.length > 0 && errors.length === 0) {
              toast({
                title: "Upload Successful",
                description: `${valid.length} items have been imported successfully.`,
              });
              setSelectedFile(null);
              onOpenChange(false);
            } else if (valid.length > 0) {
              toast({
                title: "Partial Upload",
                description: `${valid.length} items imported, ${errors.length} rows had errors.`,
              });
            } else {
              toast({
                variant: "destructive",
                title: "Upload Failed",
                description: "No valid items found in the file.",
              });
            }
          } else {
            // Handle movements upload
            toast({
              title: "Upload Complete",
              description: `${results.data.length} movements processed.`,
            });
            setSelectedFile(null);
            onOpenChange(false);
          }
        },
        error: (error) => {
          toast({
            variant: "destructive",
            title: "Parse Error",
            description: `Failed to parse CSV: ${error.message}`,
          });
        }
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "There was an error uploading the file. Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    if (uploadType === 'items') {
      generateItemsTemplate();
    } else {
      generateMovementsTemplate();
    }
  };

  const getTitle = () => {
    return uploadType === 'items' ? 'Upload Packaging Items' : 'Upload Packaging Movements';
  };

  const getDescription = () => {
    return uploadType === 'items' 
      ? 'Upload a CSV file to bulk import packaging items into your inventory.'
      : 'Upload a CSV file to bulk import packaging movements and deliveries.';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Download Template */}
          <div className="space-y-2">
            <Label>Step 1: Download Template</Label>
            <Button variant="outline" onClick={downloadTemplate} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
            <p className="text-xs text-muted-foreground">
              Download the template file, fill it with your data, and upload it below.
            </p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Step 2: Upload Your CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Parse Results */}
          {parseResults && (
            <div className="space-y-2">
              {parseResults.success > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Successfully processed {parseResults.success} items.
                  </AlertDescription>
                </Alert>
              )}
              {parseResults.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">{parseResults.errors.length} errors found:</p>
                    <ul className="text-xs space-y-1 max-h-24 overflow-auto">
                      {parseResults.errors.slice(0, 5).map((error, i) => (
                        <li key={i}>• {error}</li>
                      ))}
                      {parseResults.errors.length > 5 && (
                        <li>• ...and {parseResults.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Upload Instructions */}
          <div className="space-y-2">
            <Label>Important Notes:</Label>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Make sure your CSV file follows the exact format from the template</li>
              <li>• {uploadType === 'items' ? 'Items with the same SKU will be updated' : 'All movements will be added as new records'}</li>
              <li>• Large files may take a few moments to process</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!selectedFile || isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};