import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Factory, Loader2 } from 'lucide-react';

export default function CompanyOnboarding() {
  const { user } = useAuth();
  const { refresh } = useCompanySettings();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ company_name: '', industry: '', address: '', phone: '' });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('company_settings' as any).upsert({
      id: 1,
      company_name: form.company_name.trim(),
      industry: form.industry.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      setup_complete: true,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save company details', description: error.message, variant: 'destructive' });
      return;
    }
    await refresh();
    toast({ title: 'Welcome to ERP.ai!', description: `${form.company_name} is ready to go.` });
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-2">
            <Factory className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Set up your company</CardTitle>
          <CardDescription>
            Tell us about your manufacturing company. You can change all of this later in settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company name *</Label>
              <Input id="company_name" value={form.company_name} onChange={set('company_name')}
                placeholder="Acme Manufacturing" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" value={form.industry} onChange={set('industry')}
                placeholder="Nutraceuticals, food & beverage, cosmetics…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={set('address')} placeholder="Street, city, state" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={set('phone')} placeholder="(555) 555-5555" />
            </div>
            <Button type="submit" className="w-full" disabled={saving || !form.company_name.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Finish setup
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
