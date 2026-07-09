import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuickVendorCreateProps {
  onVendorCreated: (vendorId: string, vendorName: string) => void;
  createVendor: (vendorData: any) => Promise<any>;
}

export function QuickVendorCreate({ onVendorCreated, createVendor }: QuickVendorCreateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_info: '',
    emails: [],
    phone_numbers: []
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsLoading(true);
    try {
      const result = await createVendor({
        name: formData.name,
        contact_info: formData.contact_info || null,
        emails: formData.emails,
        phone_numbers: formData.phone_numbers
      });

      if (result) {
        onVendorCreated(result.id, result.name);
        setFormData({ name: '', contact_info: '', emails: [], phone_numbers: [] });
        setIsOpen(false);
        toast({
          title: "Vendor Created",
          description: `${result.name} has been added successfully.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create vendor. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ml-2 h-8 w-8 p-0"
        onClick={() => setIsOpen(true)}
        title="Add New Vendor"
      >
        <Plus className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Vendor</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Vendor Name *</Label>
            <Input
              id="vendor-name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter vendor name..."
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="vendor-contact">Contact Info</Label>
            <Input
              id="vendor-contact"
              value={formData.contact_info}
              onChange={(e) => handleInputChange('contact_info', e.target.value)}
              placeholder="Email or phone number..."
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={isLoading || !formData.name.trim()}
              className="flex-1"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Vendor
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}