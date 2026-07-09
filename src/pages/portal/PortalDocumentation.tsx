import { FolderOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function PortalDocumentation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-muted-foreground text-sm mt-1">
          COAs, spec sheets, and other documents we've shared with you.
        </p>
      </div>
      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center gap-3 text-muted-foreground">
          <FolderOpen className="h-10 w-10" />
          <div className="text-sm">Your documents will appear here soon.</div>
        </CardContent>
      </Card>
    </div>
  );
}
