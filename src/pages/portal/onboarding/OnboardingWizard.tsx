import { useState } from 'react';
import { useCustomerOnboarding, ONBOARDING_STEPS } from '@/hooks/useCustomerOnboarding';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const STEP_LABELS: Record<string, string> = {
  company_info: 'Company info',
  contacts: 'Contacts',
  compliance_docs: 'Compliance docs',
  payment_terms: 'Payment terms',
  signed_agreement: 'Agreement',
};

const OnboardingWizard = () => {
  const { data, update, submit, isLoading } = useCustomerOnboarding();
  const [step, setStep] = useState(0);

  if (isLoading || !data) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  if (data.status === 'approved') {
    return (
      <Card>
        <CardHeader><CardTitle>Onboarding complete</CardTitle></CardHeader>
        <CardContent>Your account is fully approved. Thank you!</CardContent>
      </Card>
    );
  }

  if (data.status === 'pending_review') {
    return (
      <Card>
        <CardHeader><CardTitle>Submitted — awaiting review</CardTitle></CardHeader>
        <CardContent>Our team is reviewing your information. You'll be notified by email.</CardContent>
      </Card>
    );
  }

  const currentKey = ONBOARDING_STEPS[step];
  const ci = (data.company_info as any) || {};
  const ba = (data.billing_address as any) || {};
  const sa = (data.shipping_address as any) || {};
  const pt = (data.payment_terms as any) || {};
  const contacts = (data.contacts as any[]) || [];

  const next = () => setStep((s) => Math.min(ONBOARDING_STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const handleSubmit = async () => {
    try {
      await submit.mutateAsync();
      toast.success('Submitted for review');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const setField = async (patch: Record<string, any>) => {
    try {
      await update.mutateAsync(patch);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const progress = ((step + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customer onboarding</h1>
        <p className="text-muted-foreground mt-1">Complete each step to activate your account.</p>
      </div>

      <Progress value={progress} />
      <div className="text-sm text-muted-foreground">Step {step + 1} of {ONBOARDING_STEPS.length}: {STEP_LABELS[currentKey]}</div>

      <Card>
        <CardHeader><CardTitle>{STEP_LABELS[currentKey]}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {currentKey === 'company_info' && (
            <>
              <div><Label>Legal company name</Label><Input defaultValue={ci.legal_name || ''} onBlur={(e) => setField({ company_info: { ...ci, legal_name: e.target.value } })} /></div>
              <div><Label>DBA</Label><Input defaultValue={ci.dba || ''} onBlur={(e) => setField({ company_info: { ...ci, dba: e.target.value } })} /></div>
              <div><Label>EIN / Tax ID</Label><Input defaultValue={ci.ein || ''} onBlur={(e) => setField({ company_info: { ...ci, ein: e.target.value } })} /></div>
              <div><Label>Website</Label><Input defaultValue={ci.website || ''} onBlur={(e) => setField({ company_info: { ...ci, website: e.target.value } })} /></div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                <div className="col-span-2 font-medium text-sm">Billing address</div>
                <div><Label>Street</Label><Input defaultValue={ba.street || ''} onBlur={(e) => setField({ billing_address: { ...ba, street: e.target.value } })} /></div>
                <div><Label>City</Label><Input defaultValue={ba.city || ''} onBlur={(e) => setField({ billing_address: { ...ba, city: e.target.value } })} /></div>
                <div><Label>State</Label><Input defaultValue={ba.state || ''} onBlur={(e) => setField({ billing_address: { ...ba, state: e.target.value } })} /></div>
                <div><Label>Zip</Label><Input defaultValue={ba.zip || ''} onBlur={(e) => setField({ billing_address: { ...ba, zip: e.target.value } })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                <div className="col-span-2 font-medium text-sm">Shipping address</div>
                <div><Label>Street</Label><Input defaultValue={sa.street || ''} onBlur={(e) => setField({ shipping_address: { ...sa, street: e.target.value } })} /></div>
                <div><Label>City</Label><Input defaultValue={sa.city || ''} onBlur={(e) => setField({ shipping_address: { ...sa, city: e.target.value } })} /></div>
                <div><Label>State</Label><Input defaultValue={sa.state || ''} onBlur={(e) => setField({ shipping_address: { ...sa, state: e.target.value } })} /></div>
                <div><Label>Zip</Label><Input defaultValue={sa.zip || ''} onBlur={(e) => setField({ shipping_address: { ...sa, zip: e.target.value } })} /></div>
              </div>
            </>
          )}

          {currentKey === 'contacts' && (
            <>
              <p className="text-sm text-muted-foreground">List your primary contacts (one per line: Name, Role, Email, Phone).</p>
              <Textarea
                rows={8}
                defaultValue={contacts.map((c: any) => `${c.name || ''}, ${c.role || ''}, ${c.email || ''}, ${c.phone || ''}`).join('\n')}
                onBlur={(e) => {
                  const parsed = e.target.value.split('\n').filter(Boolean).map((line) => {
                    const [name, role, email, phone] = line.split(',').map((s) => s.trim());
                    return { name, role, email, phone };
                  });
                  setField({ contacts: parsed });
                }}
              />
            </>
          )}

          {currentKey === 'compliance_docs' && (
            <p className="text-sm text-muted-foreground">
              Document upload coming soon. For now, please email your W-9 and Certificate of Insurance to your account manager.
            </p>
          )}

          {currentKey === 'payment_terms' && (
            <>
              <div><Label>Preferred terms</Label><Input placeholder="Net 30" defaultValue={pt.terms || ''} onBlur={(e) => setField({ payment_terms: { ...pt, terms: e.target.value } })} /></div>
              <div><Label>Payment method</Label><Input placeholder="ACH / Check / Wire" defaultValue={pt.method || ''} onBlur={(e) => setField({ payment_terms: { ...pt, method: e.target.value } })} /></div>
            </>
          )}

          {currentKey === 'signed_agreement' && (
            <>
              <p className="text-sm text-muted-foreground">By typing your full name below, you agree to the standard supply terms.</p>
              <div>
                <Label>Type your full name to sign</Label>
                <Input
                  defaultValue={data.signature_name || ''}
                  onBlur={(e) => setField({ signature_name: e.target.value, signature_signed_at: new Date().toISOString() })}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prev} disabled={step === 0}>Back</Button>
        {step < ONBOARDING_STEPS.length - 1 ? (
          <Button onClick={next}>Next</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submit.isPending || !data.signature_name}>
            {submit.isPending ? 'Submitting…' : 'Submit for review'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
