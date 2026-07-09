import { AlertTriangle, Shield, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface FinancialAccessDeniedProps {
  feature?: string;
  onContactAdmin?: () => void;
}

export function FinancialAccessDenied({ 
  feature = "financial data", 
  onContactAdmin 
}: FinancialAccessDeniedProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Access Restricted</CardTitle>
          <CardDescription>
            You don't have permission to view {feature}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Financial Data Protection</AlertTitle>
            <AlertDescription>
              This area contains sensitive financial information including vendor details, 
              pricing, and purchase terms. Access is restricted to authorized personnel only.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Available to all authenticated users</span>
            </div>
          </div>

          {onContactAdmin && (
            <Button 
              onClick={onContactAdmin} 
              variant="outline" 
              className="w-full"
            >
              Request Access
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}