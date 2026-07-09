import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getCustomerPortalOrigin } from '@/lib/portalHost';

interface Props {
  signupCode: string | null | undefined;
  customerName?: string;
}

/**
 * Shareable per-customer portal signup link.
 * First person to sign up via this link becomes the owner of that customer.
 */
export const CustomerPortalLinkCard = ({ signupCode, customerName }: Props) => {
  const [copied, setCopied] = useState(false);

  if (!signupCode) return null;

  const url = `${getCustomerPortalOrigin()}/portal/auth?company=${encodeURIComponent(signupCode)}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Portal link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-primary" />
          Portal Signup Link
        </CardTitle>
        <CardDescription>
          Share this link with {customerName || 'this customer'}. The first person to sign up
          becomes the owner; anyone after that joins as a member. The owner can invite teammates
          from inside the portal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-stretch gap-2">
          <Input readOnly value={url} className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={copy} title="Copy link">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.open(url, '_blank', 'noopener')}
            title="Open link"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
