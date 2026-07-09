// Security utilities for URL validation and safe external link handling

/**
 * Validates if a URL is safe to open externally
 * Prevents dangerous protocols and suspicious patterns
 */
export const isUrlSafe = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    
    // Allow only safe protocols
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return false;
    }
    
    // Block suspicious patterns
    const suspiciousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /file:/i,
      /ftp:/i,
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(url))) {
      return false;
    }
    
    // Block localhost and private IPs for security
    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Sanitizes URL input to prevent XSS and other attacks
 */
export const sanitizeUrl = (url: string): string => {
  // Remove dangerous characters and normalize
  return url.trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>"']/g, ''); // Remove HTML-dangerous characters
};

/**
 * Safely opens an external URL with user confirmation and security checks
 */
export const safeOpenExternal = (url: string, description?: string): void => {
  const sanitizedUrl = sanitizeUrl(url);
  
  if (!isUrlSafe(sanitizedUrl)) {
    alert('This URL appears to be unsafe and cannot be opened.');
    return;
  }
  
  const domain = new URL(sanitizedUrl).hostname;
  const message = description 
    ? `Open ${description} at ${domain}?`
    : `Open external link at ${domain}?`;
  
  if (confirm(message)) {
    window.open(sanitizedUrl, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Validates and formats URLs for storage
 */
export const validateAndFormatUrl = (url: string): { isValid: boolean; formattedUrl?: string; error?: string } => {
  if (!url || url.trim().length === 0) {
    return { isValid: false, error: 'URL is required' };
  }
  
  const sanitized = sanitizeUrl(url);
  
  // Add protocol if missing
  let formattedUrl = sanitized;
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = 'https://' + formattedUrl;
  }
  
  if (!isUrlSafe(formattedUrl)) {
    return { isValid: false, error: 'URL is not safe or uses an unsupported protocol' };
  }
  
  try {
    new URL(formattedUrl); // Validate URL format
    return { isValid: true, formattedUrl };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
};