import { Shield, AlertTriangle, Users, Phone, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EmployeeDataAccessDeniedProps {
  context?: 'viewing' | 'editing' | 'self_service' | 'general';
  className?: string;
}

export const EmployeeDataAccessDenied = ({ 
  context = 'general', 
  className = "" 
}: EmployeeDataAccessDeniedProps) => {
  const getContextMessage = () => {
    switch (context) {
      case 'viewing':
        return "You don't have permission to view employee sensitive data.";
      case 'editing':
        return "You don't have permission to modify employee sensitive data.";
      case 'self_service':
        return "Employee self-service access to sensitive data has been restricted for security.";
      default:
        return "Access to employee sensitive data is strictly limited to HR personnel.";
    }
  };

  const getSecurityMessage = () => {
    switch (context) {
      case 'self_service':
        return "Due to the highly sensitive nature of this data (including partial SSNs, home addresses, and salary information), employee self-service access has been disabled. Please contact HR for any updates to your personal information.";
      default:
        return "This data contains highly sensitive personal information including partial social security numbers, home addresses, emergency contacts, and salary information. Access is strictly controlled and limited to authorized HR personnel only.";
    }
  };

  return (
    <div className={`max-w-2xl mx-auto p-6 ${className}`}>
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-red-800 dark:text-red-200">
            {context === 'self_service' ? 'Self-Service Restricted' : 'HR Personnel Only'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-red-200 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-700 dark:text-red-300">
              {getContextMessage()}
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2 flex items-center">
                <Shield className="w-4 h-4 mr-2" />
                Enhanced Security Policy
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {getSecurityMessage()}
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Who Has Access?
              </h3>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• <strong>HR Managers:</strong> Full access to all employee sensitive data</li>
                <li>• <strong>System Administrators:</strong> Full system access for maintenance</li>
                <li>• <strong>Managers:</strong> Basic non-sensitive info about direct reports only</li>
                <li>• <strong>Employees:</strong> No direct access - must contact HR</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                Data Protection Details
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                This system protects:
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Partial Social Security Numbers</li>
                <li>• Home addresses and personal contact information</li>
                <li>• Emergency contact details</li>
                <li>• Salary bands and compensation data</li>
                <li>• Security clearance information</li>
              </ul>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                Need to Update Your Information?
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {context === 'self_service' 
                  ? "Please contact your HR department to update your emergency contact information, address, or other personal details. This ensures proper verification and maintains data security."
                  : "Contact your HR manager to request access to employee data or to update employee information. All access requests are logged and monitored for security compliance."
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};