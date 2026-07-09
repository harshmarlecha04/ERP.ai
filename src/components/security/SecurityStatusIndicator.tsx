import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, AlertTriangle } from "lucide-react";

interface SecurityStatusIndicatorProps {
  securityLevel?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const SecurityStatusIndicator: React.FC<SecurityStatusIndicatorProps> = ({ 
  securityLevel = 'standard',
  size = 'md',
  showIcon = true
}) => {
  // Don't render anything for trade secret level
  if (securityLevel === 'trade_secret') {
    return null;
  }

  const getSecurityConfig = () => {
    switch (securityLevel) {
      case 'confidential':
        return {
          label: 'CONFIDENTIAL',
          className: 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200',
          icon: <Lock className="h-3 w-3" />,
          description: 'Restricted access - Authorized personnel only'
        };
      case 'standard':
        return {
          label: 'STANDARD',
          className: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200',
          icon: <Eye className="h-3 w-3" />,
          description: 'Standard access level'
        };
      default:
        return {
          label: 'UNKNOWN',
          className: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: <AlertTriangle className="h-3 w-3" />,
          description: 'Security level unknown'
        };
    }
  };

  const config = getSecurityConfig();
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  return (
    <Badge 
      className={`${config.className} ${sizeClasses[size]} font-semibold flex items-center gap-1 transition-colors`}
      title={config.description}
    >
      {showIcon && config.icon}
      {config.label}
    </Badge>
  );
};