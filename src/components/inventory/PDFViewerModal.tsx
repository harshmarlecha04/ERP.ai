import React, { useState } from "react";
import { Upload, X, FileText, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { safeOpenExternal } from "@/utils/security";

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialName: string;
  pdfFile?: { name: string; url: string } | null;
  onUpload: (file: File) => void;
  onDelete: () => void;
}

export function PDFViewerModal({
  isOpen,
  onClose,
  materialName,
  pdfFile,
  onUpload,
  onDelete,
}: PDFViewerModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
      onClose();
    }
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  const pdfUrl = pdfFile?.url || null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="[--dialog-max-width:56rem] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Certificate of Analysis - {materialName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[70vh]">
          {pdfFile && pdfUrl ? (
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">{pdfFile.name}</span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => safeOpenExternal(pdfUrl, 'Certificate of Analysis')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 border rounded-lg overflow-hidden">
                <iframe
                  src={pdfUrl}
                  className="w-full h-full"
                  title="PDF Viewer"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <p className="text-muted-foreground text-center">
                No Certificate of Analysis uploaded for this material.
              </p>
              
              <div className="space-y-4 w-full max-w-md">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-upload"
                />
                <label
                  htmlFor="pdf-upload"
                  className="flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <Upload className="h-5 w-5" />
                  <span>Upload PDF Certificate</span>
                </label>
                
                {selectedFile && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm">{selectedFile.name}</span>
                    <Button onClick={handleUpload} size="sm">
                      Upload
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {pdfFile && (
            <div className="mt-4 space-y-4">
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Replace Certificate</h4>
                <div className="flex items-center space-x-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-replace"
                  />
                  <label
                    htmlFor="pdf-replace"
                    className="flex items-center space-x-2 px-3 py-2 border border-input rounded-md cursor-pointer hover:bg-accent text-sm"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Choose New PDF</span>
                  </label>
                  
                  {selectedFile && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {selectedFile.name}
                      </span>
                      <Button onClick={handleUpload} size="sm">
                        Replace
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}