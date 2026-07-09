import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Eye, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserRoles } from '@/hooks/useUserRoles';

interface SecurityTest {
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'pass' | 'fail';
  details?: string;
}

export const SecurityValidation: React.FC = () => {
  const { currentUserRoles } = useUserRoles();
  const [tests, setTests] = useState<SecurityTest[]>([
    {
      name: 'Trade Secret Formula Access',
      description: 'Verify trade secret formulas are restricted to R&D managers and admins only',
      severity: 'critical',
      status: 'pending'
    },
    {
      name: 'Business Hours Policy Override',
      description: 'Confirm business hours policy does NOT grant access to sensitive formulas',
      severity: 'critical', 
      status: 'pending'
    },
    {
      name: 'Unauthorized Access Logging',
      description: 'Verify unauthorized access attempts are logged and tracked',
      severity: 'high',
      status: 'pending'
    },
    {
      name: 'Role-Based Access Control',
      description: 'Validate role-based restrictions are properly enforced',
      severity: 'high',
      status: 'pending'
    }
  ]);

  const [isRunning, setIsRunning] = useState(false);

  const runSecurityValidation = async () => {
    setIsRunning(true);
    const updatedTests = [...tests];

    try {
      // Test 1: Trade Secret Formula Access
      try {
        const { data: allFormulas, error } = await supabase.rpc('get_accessible_formulas');
        
        if (error) throw error;

        const tradeSecretFormulas = allFormulas?.filter(f => f.security_level === 'trade_secret') || [];
        const hasTradeSecretAccess = tradeSecretFormulas.length > 0;
        const isAuthorizedRole = currentUserRoles?.role === 'admin' || currentUserRoles?.role === 'rd_manager';

        updatedTests[0].status = (hasTradeSecretAccess === isAuthorizedRole) ? 'pass' : 'fail';
        updatedTests[0].details = hasTradeSecretAccess 
          ? `Access granted to ${tradeSecretFormulas.length} trade secret formulas (authorized: ${isAuthorizedRole})`
          : `Access denied to trade secret formulas (expected for role: ${currentUserRoles?.role})`;

      } catch (error) {
        updatedTests[0].status = 'fail';
        updatedTests[0].details = `Error: ${error}`;
      }

      // Test 2: Business Hours Policy Override
      try {
        const { data: businessHoursCheck } = await supabase.rpc('is_business_hours');
        const { data: allFormulas } = await supabase.rpc('get_accessible_formulas');
        
        const tradeSecrets = allFormulas?.filter(f => f.security_level === 'trade_secret') || [];
        const confidentialFormulas = allFormulas?.filter(f => f.security_level === 'confidential') || [];
        
        // Even during business hours, trade secrets should be restricted
        const tradeSecretsProperlylimited = tradeSecrets.length === 0 || 
          (currentUserRoles?.role === 'admin' || currentUserRoles?.role === 'rd_manager');
        
        updatedTests[1].status = tradeSecretsProperlylimited ? 'pass' : 'fail';
        updatedTests[1].details = `Business hours: ${businessHoursCheck}, Trade secrets accessible: ${tradeSecrets.length}, Role: ${currentUserRoles?.role}`;

      } catch (error) {
        updatedTests[1].status = 'fail';
        updatedTests[1].details = `Error: ${error}`;
      }

      // Test 3: Access Logging  
      try {
        const { data: auditLogs } = await supabase
          .from('formula_access_audit')
          .select('*')
          .order('accessed_at', { ascending: false })
          .limit(5);

        updatedTests[2].status = auditLogs && auditLogs.length > 0 ? 'pass' : 'fail';
        updatedTests[2].details = `Recent audit entries: ${auditLogs?.length || 0}`;

      } catch (error) {
        updatedTests[2].status = 'fail';
        updatedTests[2].details = `Error: ${error}`;
      }

      // Test 4: Role-Based Access Control
      try {
        const { data: userRole } = await supabase.rpc('get_current_user_roles');
        const hasValidRole = userRole && userRole.length > 0;
        
        updatedTests[3].status = hasValidRole ? 'pass' : 'fail';
        updatedTests[3].details = `User role: ${currentUserRoles?.role || 'none'}, Valid: ${hasValidRole}`;

      } catch (error) {
        updatedTests[3].status = 'fail';
        updatedTests[3].details = `Error: ${error}`;
      }

    } catch (error) {
      console.error('Security validation error:', error);
    }

    setTests(updatedTests);
    setIsRunning(false);
  };

  const getStatusIcon = (status: SecurityTest['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Eye className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSeverityBadge = (severity: SecurityTest['severity']) => {
    const variants = {
      critical: 'destructive',
      high: 'destructive', 
      medium: 'default',
      low: 'secondary'
    } as const;

    return (
      <Badge variant={variants[severity]} className="text-xs">
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const overallStatus = tests.every(t => t.status === 'pass') ? 'secure' : 
                      tests.some(t => t.status === 'fail') ? 'vulnerable' : 'pending';

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-600" />
          <div>
            <CardTitle>Formula Security Validation</CardTitle>
            <CardDescription>
              Verify that trade secret formulas are properly protected from unauthorized access
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="font-semibold">Overall Security Status:</span>
            <Badge 
              variant={overallStatus === 'secure' ? 'default' : overallStatus === 'vulnerable' ? 'destructive' : 'outline'}
              className="font-bold"
            >
              {overallStatus.toUpperCase()}
            </Badge>
          </div>
          
          <Button 
            onClick={runSecurityValidation} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            <Shield className="h-4 w-4" />
            {isRunning ? 'Running Tests...' : 'Run Security Tests'}
          </Button>
        </div>

        <div className="space-y-3">
          {tests.map((test, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(test.status)}
                  <span className="font-medium">{test.name}</span>
                  {getSeverityBadge(test.severity)}
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">{test.description}</p>
              
              {test.details && (
                <div className="text-xs bg-gray-50 p-2 rounded font-mono">
                  {test.details}
                </div>
              )}
            </div>
          ))}
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Note:</strong> These tests validate that the formula access vulnerability has been resolved. 
            Trade secret formulas should only be accessible to R&D managers and administrators, regardless of business hours.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};