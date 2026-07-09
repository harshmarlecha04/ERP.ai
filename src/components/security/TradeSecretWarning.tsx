import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Clock, AlertTriangle } from "lucide-react";

interface TradeSecretWarningProps {
  securityLevel?: string;
  className?: string;
}

export const TradeSecretWarning: React.FC<TradeSecretWarningProps> = ({ 
  securityLevel, 
  className = "" 
}) => {
  if (securityLevel !== 'trade_secret') {
    return null;
  }

  return (
    <Alert className={`border-red-200 bg-red-50 ${className}`}>
      <Shield className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-800 font-medium">
        TRADE SECRET - Maximum security protocols active
      </AlertDescription>
    </Alert>
  );
};