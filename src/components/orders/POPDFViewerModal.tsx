import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Trash2, Upload, FileText, X, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSignedPdfUrl, parsePdfLocation } from "@/utils/pdfStorage";

interface POPDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  poNumber: string | null;
  pdfUrl: string | null;
  onPdfChange: () => void;
  onUploadSuccess?: (pdfPath: string) => void;
}

export function POPDFViewerModal({
  isOpen,
  onClose,
  orderId,
  poNumber,
  pdfUrl,
  onPdfChange,
  onUploadSuccess,
}: POPDFViewerModalProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  // Resolve signed URL when pdfUrl changes or modal opens
  useEffect(() => {
    if (isOpen && pdfUrl) {
      setIsLoadingUrl(true);
      getSignedPdfUrl(pdfUrl)
        .then(setSignedUrl)
        .finally(() => setIsLoadingUrl(false));
    } else {
      setSignedUrl(null);
    }
  }, [isOpen, pdfUrl]);

  // Generate Google Docs viewer URL for PDF to avoid browser extension blocking
  const getViewerUrl = (url: string) => {
    const encodedUrl = encodeURIComponent(url);
    return `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
    } else if (file) {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !orderId) return;

    setIsUploading(true);
    try {
      const fileName = `${orderId}/${Date.now()}-${selectedFile.name}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("order-pdfs")
        .upload(fileName, selectedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the file path (not a public URL) for signed URL generation
      const { error: updateError } = await supabase
        .from("order_headers")
        .update({ pdf_url: fileName })
        .eq("id", orderId);

      if (updateError) throw updateError;

      toast({
        title: "PDF uploaded successfully",
        description: `PO document uploaded for ${poNumber || "order"}`,
      });

      setSelectedFile(null);
      onPdfChange();
      onUploadSuccess?.(fileName);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!orderId || !pdfUrl) return;

    setIsDeleting(true);
    try {
      const { bucket, path } = parsePdfLocation(pdfUrl);
      await supabase.storage.from(bucket).remove([path]);

      // Clear pdf_url in order_headers
      const { error: updateError } = await supabase
        .from("order_headers")
        .update({ pdf_url: null })
        .eq("id", orderId);

      if (updateError) throw updateError;

      toast({
        title: "PDF deleted",
        description: "PO document has been removed",
      });

      onPdfChange();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (signedUrl) {
      window.open(signedUrl, "_blank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="[--dialog-max-width:min(1400px,95vw)] w-[95vw] max-h-[95vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PO Document {poNumber ? `- ${poNumber}` : ""}
            {signedUrl && (
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={() => window.open(signedUrl, "_blank", "noopener,noreferrer")} title="Open in new window">
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {pdfUrl ? (
            <>
              {/* PDF Viewer */}
              <div className="border rounded-lg overflow-hidden bg-muted flex-1 min-h-[70vh]">
                {isLoadingUrl ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : signedUrl ? (
                  <iframe
                    src={getViewerUrl(signedUrl)}
                    className="block h-full min-h-[70vh] w-full"
                    title={`PO PDF - ${poNumber}`}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                    <p>Unable to preview PDF inline.</p>
                    {pdfUrl && (
                      <Button variant="outline" onClick={() => window.open(signedUrl ?? pdfUrl, "_blank", "noopener,noreferrer")}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in new tab
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button variant="outline" asChild>
                      <span>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Replace
                      </span>
                    </Button>
                  </label>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>

              {/* Replace file confirmation */}
              {selectedFile && (
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <p className="text-sm">
                    Replace with: <strong>{selectedFile.name}</strong>
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleUpload} disabled={isUploading}>
                      {isUploading ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Confirm Replace
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedFile(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Upload Interface */}
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No PDF Uploaded</h3>
                <p className="text-muted-foreground mb-6">
                  Upload a PDF document for this Purchase Order
                </p>
                
                <label className="cursor-pointer inline-block">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Select PDF File
                    </span>
                  </Button>
                </label>
              </div>

              {/* Selected file confirmation */}
              {selectedFile && (
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <p className="text-sm">
                    Selected: <strong>{selectedFile.name}</strong>
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleUpload} disabled={isUploading}>
                      {isUploading ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}