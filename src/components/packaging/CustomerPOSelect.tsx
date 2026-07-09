import * as React from "react";
import { Check, ChevronsUpDown, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCustomerPOs } from "@/hooks/useCustomerPOs";
import { CustomerPOPickerModal } from "./CustomerPOPickerModal";

interface CustomerPOSelectProps {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** When provided, opens the rich picker modal (filtered to this customer) instead of the popover. */
  customerId?: string | null;
  customerName?: string | null;
}

export const CustomerPOSelect: React.FC<CustomerPOSelectProps> = ({
  value,
  onChange,
  placeholder = "Link to customer PO...",
  className,
  disabled,
  customerId,
  customerName,
}) => {
  const [open, setOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const { data: pos = [], isLoading } = useCustomerPOs();
  const selected = pos.find((p) => p.id === value);

  // Rich picker mode: triggered by passing customerId/customerName
  const useRichPicker = customerId !== undefined;

  if (useRichPicker) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setPickerOpen(true)}
          className={cn(
            "w-full justify-between font-normal h-10",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate flex items-center gap-2">
            <FileText className="h-4 w-4 opacity-60 shrink-0" />
            {selected ? selected.label : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selected && (
              <X
                className="h-4 w-4 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
        <CustomerPOPickerModal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          customerId={customerId ?? null}
          customerName={customerName}
          selectedPoId={value}
          onSelect={onChange}
        />
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal h-10", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <div className="flex items-center gap-1 shrink-0">
            {selected && (
              <X
                className="h-4 w-4 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Search PO# or customer..." />
          <CommandList>
            <CommandEmpty>{isLoading ? "Loading..." : "No POs found."}</CommandEmpty>
            <CommandGroup>
              {pos.map((po) => (
                <CommandItem
                  key={po.id}
                  value={`${po.po_number || ""} ${po.order_number || ""} ${po.customer_name || ""}`}
                  onSelect={() => {
                    onChange(po.id === value ? null : po.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === po.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="text-sm">{po.label}</span>
                    {po.status && (
                      <span className="text-xs text-muted-foreground capitalize">{po.status.replace(/_/g, " ")}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
