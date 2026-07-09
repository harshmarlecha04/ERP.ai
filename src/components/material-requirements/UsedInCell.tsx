import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";

interface Formula {
  formula_code: string;
  formula_name: string;
  batches: number;
}

interface UsedInCellProps {
  formulas: Formula[];
}

const FormulaBadge = ({ formula }: { formula: Formula }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="cursor-help text-xs">
          {formula.formula_code}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">{formula.formula_name}</p>
          <p className="text-sm text-muted-foreground">
            {formula.batches} batch{formula.batches !== 1 ? 'es' : ''}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const UsedInCell = ({ formulas }: UsedInCellProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (formulas.length === 0) {
    return <span className="text-xs text-muted-foreground">Not used</span>;
  }

  if (formulas.length === 1) {
    return <FormulaBadge formula={formulas[0]} />;
  }

  const [firstFormula, ...restFormulas] = formulas;

  return (
    <div className="flex items-center gap-2 justify-center">
      <FormulaBadge formula={firstFormula} />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline-offset-2 hover:underline transition-colors">
            + {restFormulas.length} more
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-md">
          <div className="flex flex-wrap gap-1.5">
            {restFormulas.map((formula, idx) => (
              <FormulaBadge key={idx} formula={formula} />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
