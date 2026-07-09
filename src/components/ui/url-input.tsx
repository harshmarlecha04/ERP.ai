import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validateAndFormatUrl } from '@/utils/security';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface UrlInputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
  className?: string;
}

/**
 * A secure URL input component with validation and formatting
 */
export const UrlInput: React.FC<UrlInputProps> = ({
  label,
  placeholder = "https://example.com",
  value,
  onChange,
  required = false,
  id,
  className
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [validation, setValidation] = useState<{ isValid: boolean; error?: string }>({ isValid: true });
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    if (localValue.trim()) {
      const result = validateAndFormatUrl(localValue);
      setValidation(result);
      setShowValidation(true);
      
      if (result.isValid && result.formattedUrl) {
        onChange(result.formattedUrl);
        setLocalValue(result.formattedUrl);
      }
    } else if (required) {
      setValidation({ isValid: false, error: 'This field is required' });
      setShowValidation(true);
    } else {
      setValidation({ isValid: true });
      setShowValidation(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    setShowValidation(false);
    
    // If user clears the field and it's not required, clear the parent value
    if (!newValue.trim() && !required) {
      onChange('');
    }
  };

  return (
    <div className={className}>
      <Label htmlFor={id}>{label} {required && <span className="text-destructive">*</span>}</Label>
      <div className="relative">
        <Input
          id={id}
          type="url"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          className={validation.isValid ? '' : 'border-destructive'}
        />
        {showValidation && localValue.trim() && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            {validation.isValid ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
      </div>
      {showValidation && validation.error && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validation.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};