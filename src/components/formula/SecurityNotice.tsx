import React from 'react';
import { Shield, Clock, Eye, AlertTriangle, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface SecurityNoticeProps {
  securityLevel: string;
  className?: string;
}

// Security model: Role-based access only, no business hours exceptions

export const SecurityNotice: React.FC<SecurityNoticeProps> = ({ 
  securityLevel, 
  className 
}) => {
  const getSecurityConfig = (level: string) => {
    switch (level.toLowerCase()) {
      case 'trade_secret':
        return {
          icon: Lock,
          variant: 'destructive' as const,
          badgeVariant: 'destructive' as const,
          title: 'TRADE SECRET - MAXIMUM SECURITY',
          description: 'This formula contains proprietary trade secret information. Access restricted to authorized R&D personnel only. All access is monitored and logged.',
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200',
          isTradeSecret: true
        };
      case 'confidential':
        return {
          icon: Eye,
          variant: 'default' as const,
          badgeVariant: 'secondary' as const,
          title: 'CONFIDENTIAL FORMULA',
          description: 'This formula contains confidential information. Access restricted to authorized personnel (Admin, R&D, Production Managers) only.',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50 border-orange-200',
          isTradeSecret: false
        };
      default:
        return {
          icon: Shield,
          variant: 'default' as const,
          badgeVariant: 'outline' as const,
          title: 'STANDARD FORMULA',
          description: 'Standard formula with role-based access controls. Available to authorized personnel only.',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
          isTradeSecret: false
        };
    }
  };

  const config = getSecurityConfig(securityLevel);
  const IconComponent = config.icon;

  if (securityLevel.toLowerCase() === 'standard') {
    return null; // Don't show notice for standard formulas
  }

  return (
    <Alert variant={config.variant} className={className}>
      <div className="flex items-center gap-2 mb-2">
        <IconComponent className="h-4 w-4" />
        <Badge variant={config.badgeVariant} className="text-xs font-bold">
          {config.title}
        </Badge>
        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
          <Shield className="h-3 w-3 mr-1" />
          ROLE-BASED ACCESS
        </Badge>
      </div>
      <AlertDescription className="text-sm">
        {config.description}
        {config.isTradeSecret && (
          <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs">
            <Shield className="h-3 w-3 inline mr-1" />
            <strong>SECURITY ALERT:</strong> Trade secret access requires explicit authorization. 
            All access attempts are logged and monitored for security compliance.
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};

export const SecurityBadge: React.FC<{ securityLevel: string; size?: 'sm' | 'md' }> = ({ 
  securityLevel, 
  size = 'sm' 
}) => {
  const getConfig = (level: string) => {
    switch (level.toLowerCase()) {
      case 'trade_secret':
        return {
          label: 'TS',
          variant: 'destructive' as const,
          className: 'text-xs font-bold'
        };
      case 'confidential':
        return {
          label: 'CONF',
          variant: 'secondary' as const,
          className: 'text-xs font-bold'
        };
      default:
        return null;
    }
  };

  const config = getConfig(securityLevel);
  
  if (!config) return null;

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}
    >
      {config.label}
    </Badge>
  );
};