import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCustomers, type Customer } from '@/hooks/useCustomers';

interface AddCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (customer: Customer) => void;
  customer?: Customer | null;
}

export const AddCustomerModal = ({ open, onOpenChange, onSuccess, customer }: AddCustomerModalProps) => {
  const { createCustomer, updateCustomer } = useCustomers();
  
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isRdCustomer, setIsRdCustomer] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (customer) {
      setCompanyName(customer.company_name);
      setCompanyCode(customer.company_code);
      setContactPerson(customer.contact_person || '');
      setContactTitle(customer.contact_title || '');
      setEmail(customer.email || '');
      setPhone(customer.phone || '');
      setIsRdCustomer(customer.is_rd_customer);
      setNotes(customer.notes || '');
    } else {
      resetForm();
    }
  }, [customer]);

  const handleSubmit = async () => {
    if (customer) {
      // Update existing customer
      const result = await updateCustomer.mutateAsync({
        id: customer.id,
        company_name: companyName,
        company_code: companyCode.toUpperCase(),
        contact_person: contactPerson || null,
        contact_title: contactTitle || null,
        email: email || null,
        phone: phone || null,
        is_rd_customer: isRdCustomer,
        notes: notes || null,
      });

      if (onSuccess) {
        onSuccess(result);
      }
    } else {
      // Create new customer
      const result = await createCustomer.mutateAsync({
        company_name: companyName,
        company_code: companyCode.toUpperCase(),
        contact_person: contactPerson || null,
        contact_title: contactTitle || null,
        email: email || null,
        phone: phone || null,
        is_rd_customer: isRdCustomer,
        notes: notes || null,
      });

      if (onSuccess) {
        onSuccess(result);
      }
    }
    
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setCompanyName('');
    setCompanyCode('');
    setContactPerson('');
    setContactTitle('');
    setEmail('');
    setPhone('');
    setIsRdCustomer(false);
    setNotes('');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>{customer ? 'Edit Customer' : 'Add New Customer'}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Company Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Company Information</h3>
              </div>
              
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <Label htmlFor="companyCode">Company Code *</Label>
                <Input
                  id="companyCode"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                  placeholder="e.g., GOT, CBDFX"
                  className="uppercase"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier used across all systems
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isRdCustomer"
                  checked={isRdCustomer}
                  onCheckedChange={setIsRdCustomer}
                />
                <Label htmlFor="isRdCustomer">R&D Customer</Label>
              </div>
            </div>

            {/* Right Column - Contact Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Primary Contact</h3>
              </div>

              <div>
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Enter contact name"
                />
              </div>

              <div>
                <Label htmlFor="contactTitle">Title/Position</Label>
                <Input
                  id="contactTitle"
                  value={contactTitle}
                  onChange={(e) => setContactTitle(e.target.value)}
                  placeholder="e.g., Purchasing Manager"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
          </div>

          {/* Full Width - Additional Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Additional Details</h3>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or comments..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <SheetFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!companyName || !companyCode || createCustomer.isPending || updateCustomer.isPending}
          >
            {customer 
              ? (updateCustomer.isPending ? 'Updating...' : 'Update Customer')
              : (createCustomer.isPending ? 'Adding...' : 'Add Customer')
            }
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
