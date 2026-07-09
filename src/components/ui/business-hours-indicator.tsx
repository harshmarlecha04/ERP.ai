import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Shield } from 'lucide-react';
import { useUserRoles } from '@/hooks/useUserRoles';

interface BusinessHoursIndicatorProps {
  className?: string;
}

export const BusinessHoursIndicator: React.FC<BusinessHoursIndicatorProps> = ({ 
  className = "" 
}) => {
  const { hasBusinessHoursAccess } = useUserRoles();
  const isBusinessHours = hasBusinessHoursAccess();

  if (!isBusinessHours) {
    return null; // Don't show indicator outside business hours
  }

  return (
    <Badge 
      className={`bg-green-100 text-green-800 border-green-300 hover:bg-green-200 ${className}`}
      title="Business Hours Active - Full system access enabled"
    >
      <Shield className="h-3 w-3 mr-1" />
      Business Hours Active
    </Badge>
  );
};

export const BusinessHoursStatus: React.FC = () => {
  const { hasBusinessHoursAccess } = useUserRoles();
  const isBusinessHours = hasBusinessHoursAccess();

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock className="h-4 w-4" />
      <span>
        {isBusinessHours ? (
          <span className="text-green-600 font-medium">
            Business Hours Active (Mon-Fri, 7 AM - 7 PM EST)
          </span>
        ) : (
          <span className="text-amber-600">
            Outside Business Hours - Limited Access
          </span>
        )}
      </span>
    </div>
  );
};