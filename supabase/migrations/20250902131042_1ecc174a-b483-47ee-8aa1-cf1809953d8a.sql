-- Enhanced formula security - Step 1: Create the validation function first
CREATE OR REPLACE FUNCTION public.validate_formula_security_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Enforce security level requirements for trade secrets
    IF NEW.classification_level = 'trade_secret' THEN
        -- Trade secrets must have highest security level
        IF NEW.security_level NOT IN ('confidential', 'trade_secret') THEN
            RAISE EXCEPTION 'Trade secret formulas must have confidential or trade_secret security level';
        END IF;
        
        -- Trade secrets require approval flag
        NEW.requires_approval := true;
    END IF;
    
    -- Prevent downgrading security levels without admin approval
    IF TG_OP = 'UPDATE' AND OLD.classification_level IS NOT NULL THEN
        IF NEW.classification_level != OLD.classification_level THEN
            IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
                RAISE EXCEPTION 'Only admins can change formula classification levels';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger now that the function exists
CREATE TRIGGER formula_security_validation_trigger
    BEFORE INSERT OR UPDATE ON public.formulas
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_formula_security_level();