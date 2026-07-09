import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldX } from 'lucide-react';

interface AccessDeniedProps {
  resource: string;
  description?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ resource, description }) => {
  return (
    <div className="max-w-md mx-auto mt-8">
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <ShieldX className="w-6 h-6 text-destructive" />
          </div>
          <CardTitle className="text-destructive">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access {resource}
          </CardDescription>
        </CardHeader>
        {description && (
          <CardContent>
            <p className="text-sm text-muted-foreground">{description}</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
};