import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { safeOpenExternal } from '@/utils/security';

interface SecureExternalLinkProps {
  url: string;
  children: React.ReactNode;
  description?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

/**
 * A secure component for opening external links with user confirmation
 * and security validation
 */
export const SecureExternalLink: React.FC<SecureExternalLinkProps> = ({
  url,
  children,
  description,
  variant = "outline",
  size = "sm",
  className
}) => {
  const handleClick = () => {
    safeOpenExternal(url, description);
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={className}
    >
      {children}
      <ExternalLink className="h-3 w-3 ml-1" />
    </Button>
  );
};