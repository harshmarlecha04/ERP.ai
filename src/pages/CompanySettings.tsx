import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2 } from 'lucide-react';

export default function CompanySettings() {
  const { user } = useAuth();
  const { settings, loading, refresh } = useCompanySettings();
  const { hasPermission } = useUserRoles();
  const isAdmin = hasPermission('admin');
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: '', industry: '', address: '', phone: '', logo_url: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name ?? '',
        industry: settings.industry ?? '',
        address: settings.address ?? '',
        phone: settings.phone ?? '',
        logo_url: settings.logo_url ?? '',
      });
    }
  }, [settings]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('company_settings' as any).upsert({
      id: 1,
      company_name: form.company_name.trim() || 'ERP.ai',
      industry: form.industry.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      logo_url: form.logo_url.trim() || null,
      setup_complete: true,
      created_by: settings?.created_by ?? user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    await refresh();
    toast({ title: 'Saved', description: 'Company details updated.' });
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Company Settings</h1>
          <p className="text-sm text-muted-foreground">
            These details appear on your documents (COAs, packing lists, invoices) and in the app.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
          <CardDescription>
            {isAdmin ? 'Update your company information below.' : 'Only admins can edit these settings.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company name</Label>
              <Input id="company_name" value={form.company_name} onChange={set('company_name')} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" value={form.industry} onChange={set('industry')} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={set('address')} disabled={!isAdmin}
                placeholder="Street, city, state, zip" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={set('phone')} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL (optional)</Label>
              <Input id="logo_url" value={form.logo_url} onChange={set('logo_url')} disabled={!isAdmin}
                placeholder="https://…/logo.png" />
            </div>
            {isAdmin && (
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save changes
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
