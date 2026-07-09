import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Shield, AlertTriangle, Key, Users, FileX } from 'lucide-react';

interface CriticalDataAccessDeniedProps {
  context?: 'salary' | 'ssn' | 'address' | 'all_critical' | 'audit_logs';
  className?: string;
}

export const CriticalDataAccessDenied: React.FC<CriticalDataAccessDeniedProps> = ({ 
  context = 'all_critical',
  className = "" 
}) => {
  const getContextMessage = () => {
    switch (context) {
      case 'salary':
        return 'Access to salary information is restricted to system administrators only.';
      case 'ssn':
        return 'Access to social security information is restricted to system administrators only.';
      case 'address':
        return 'Access to home address information is restricted to system administrators only.';
      case 'audit_logs':
        return 'Access to critical data audit logs is restricted to system administrators only.';
      default:
        return 'Access to critical employee data is restricted to system administrators only.';
    }
  };

  const getSecurityMessage = () => {
    switch (context) {
      case 'salary':
        return 'Salary information is classified as critical data due to its highly sensitive nature and potential for misuse.';
      case 'ssn':
        return 'Social Security Numbers are classified as critical data due to identity theft risks and regulatory requirements.';
      case 'address':
        return 'Home addresses are classified as critical data due to personal safety and privacy concerns.';
      case 'audit_logs':
        return 'Audit logs contain sensitive access patterns and are restricted to prevent security analysis by unauthorized personnel.';
      default:
        return 'This information is classified as critical employee data due to its highly sensitive nature.';
    }
  };

  return (
    <Card className={`w-full max-w-2xl mx-auto ${className}`}>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Shield className="h-16 w-16 text-destructive" />
            <Lock className="h-6 w-6 text-destructive absolute -top-1 -right-1 bg-background rounded-full p-0.5" />
          </div>
        </div>
        <CardTitle className="text-xl font-bold text-destructive">
          Critical Data Access Restricted
        </CardTitle>
        <CardDescription>
          Enhanced security protocols are in effect for this information
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="font-medium">
            {getContextMessage()}
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Key className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-sm">Security Classification</h4>
              <p className="text-sm text-muted-foreground">
                {getSecurityMessage()}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-sm">Who Has Access</h4>
              <p className="text-sm text-muted-foreground">
                Only system administrators can access this data. This restriction ensures an additional layer of security 
                beyond HR manager permissions for the most sensitive employee information.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-sm">Data Protection Details</h4>
              <p className="text-sm text-muted-foreground">
                • All access attempts are audited and logged<br/>
                • Data is stored separately with enhanced security<br/>
                • Access requires administrator privileges<br/>
                • IP addresses and timestamps are tracked
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <FileX className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-sm">To Request Access</h4>
              <p className="text-sm text-muted-foreground">
                Contact your system administrator if you have a legitimate business need to access this information. 
                All requests must include proper justification and will be subject to approval and audit logging.
              </p>
            </div>
          </div>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Notice:</strong> This enhanced security model protects against 
            compromised HR accounts by ensuring critical employee data requires the highest 
            level of administrative access.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};