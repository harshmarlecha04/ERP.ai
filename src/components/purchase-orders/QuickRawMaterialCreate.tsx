import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuickRawMaterialCreateProps {
  onMaterialCreated: (materialId: string, materialName: string) => void;
  createRawMaterial: (materialData: any, idempotencyKey?: string) => Promise<any>;
}

export function QuickRawMaterialCreate({ onMaterialCreated, createRawMaterial }: QuickRawMaterialCreateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: ''
  });
  const { toast } = useToast();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) return;

    setIsLoading(true);
    try {
      const materialData = {
        code: formData.code,
        name: formData.name,
        supplier: null,
        unit_of_measure: 'kg',
        lots: []
      };

      const result = await createRawMaterial(materialData);

      if (result) {
        onMaterialCreated(result.material.id, result.material.name);
        setFormData({ 
          code: '', 
          name: ''
        });
        setIsOpen(false);
        toast({
          title: "Raw Material Created",
          description: `${result.material.name} (${result.material.code}) has been added successfully.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create raw material. Please try again.",
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
        title="Add New Raw Material"
      >
        <Plus className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Raw Material</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rm-code">RM Code *</Label>
              <Input
                id="rm-code"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                placeholder="IIRM00001"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="rm-name">Name *</Label>
              <Input
                id="rm-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Material name..."
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={isLoading || !formData.code.trim() || !formData.name.trim()}
              className="flex-1"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Material
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