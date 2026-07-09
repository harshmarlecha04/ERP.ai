import { Shield, AlertTriangle, Users, Phone, Eye, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProfileAccessDeniedProps {
  context?: 'viewing' | 'directory' | 'contact_harvesting' | 'general';
  className?: string;
}

export const ProfileAccessDenied = ({ 
  context = 'general', 
  className = "" 
}: ProfileAccessDeniedProps) => {
  const getContextMessage = () => {
    switch (context) {
      case 'viewing':
        return "You don't have permission to view other users' profile information.";
      case 'directory':
        return "Access to the employee directory is restricted to prevent contact information harvesting.";
      case 'contact_harvesting':
        return "Bulk access to employee contact information is blocked to prevent spam and phishing attacks.";
      default:
        return "Access to profile information is restricted to protect employee privacy.";
    }
  };

  const getSecurityMessage = () => {
    switch (context) {
      case 'directory':
        return "The employee directory contains sensitive personal information including email addresses, phone numbers, and job titles. Access is restricted to prevent unauthorized harvesting of contact information for spam, phishing, or social engineering attacks.";
      case 'contact_harvesting':
        return "This restriction prevents malicious actors from bulk harvesting employee contact information, which could be used for targeted phishing campaigns, spam, or corporate espionage.";
      default:
        return "Profile information contains personal data that could be misused if accessed inappropriately. This includes email addresses, phone numbers, and job titles that could be used for social engineering or spam campaigns.";
    }
  };

  return (
    <div className={`max-w-2xl mx-auto p-6 ${className}`}>
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <Eye className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-red-800 dark:text-red-200">
            {context === 'directory' ? 'Directory Access Restricted' : 'Profile Access Restricted'}
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
                Privacy Protection Policy
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {getSecurityMessage()}
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Profile Access Permissions
              </h3>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• <strong>Your Own Profile:</strong> Full access to view and edit</li>
                <li>• <strong>HR Managers:</strong> Can view all profiles for legitimate business needs</li>
                <li>• <strong>Managers:</strong> Basic info about direct reports only (no personal contact details)</li>
                <li>• <strong>Other Users:</strong> No access to prevent contact harvesting</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center">
                <Lock className="w-4 h-4 mr-2" />
                What's Protected?
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                This security measure protects:
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Email addresses from spam and phishing attacks</li>
                <li>• Phone numbers from unwanted solicitation</li>
                <li>• Personal information from social engineering</li>
                <li>• Job titles and department information from competitive intelligence</li>
                <li>• Full employee directory from mass data harvesting</li>
              </ul>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                Need Employee Contact Information?
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {context === 'directory' 
                  ? "Contact your HR department for legitimate business needs requiring employee contact information. They can provide appropriate access or facilitate communication while maintaining privacy protection."
                  : "For legitimate business communication needs, contact HR or use your organization's internal directory system. This ensures proper authorization and maintains security."
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};