import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Truck, CheckCircle2 } from 'lucide-react';
import { todayET } from "@/utils/dateUtils";

interface ShipmentLineEntry {
  lineItemId: string;
  lineNumber: string;
  formulaCode: string;
  qtyAvailable: number;
  qtyShipped: number;
  qtyAccepted: number;
  accepted: boolean;
}

interface ShipmentData {
  shipDate: string;
  carrier: string;
  trackingNumber: string;
  lines: ShipmentLineEntry[];
  quickAccept: boolean;
}

interface StepShipmentAcceptanceProps {
  lineItems: Array<{
    id: string;
    line_number: string;
    formula_code: string;
    bottles_ordered: number;
  }>;
  fulfillmentLines: Array<{
    lineItemId: string;
    qtyPacked: number;
    qtyShippedTotal: number;
  }>;
  packagingLines?: Array<{
    lineItemId: string;
    actualBottles: number;
  }>;
  shipmentData: ShipmentData;
  onShipmentDataChange: (data: ShipmentData) => void;
}

export const StepShipmentAcceptance = ({
  lineItems,
  fulfillmentLines,
  packagingLines,
  shipmentData,
  onShipmentDataChange,
}: StepShipmentAcceptanceProps) => {
  // Initialize
  if (shipmentData.lines.length === 0 && lineItems.length > 0) {
    const initial: ShipmentLineEntry[] = lineItems.map(li => {
      const fl = fulfillmentLines.find(f => f.lineItemId === li.id);
      const pkg = packagingLines?.find(p => p.lineItemId === li.id);
      const qtyAvailable = (pkg?.actualBottles || fl?.qtyPacked || li.bottles_ordered) - (fl?.qtyShippedTotal || 0);
      return {
        lineItemId: li.id,
        lineNumber: li.line_number,
        formulaCode: li.formula_code,
        qtyAvailable: Math.max(0, qtyAvailable),
        qtyShipped: Math.max(0, qtyAvailable),
        qtyAccepted: Math.max(0, qtyAvailable),
        accepted: true,
      };
    });
    onShipmentDataChange({
      ...shipmentData,
      shipDate: todayET(),
      lines: initial,
      quickAccept: true,
    });
    return null;
  }

  const handleLineChange = (idx: number, field: keyof ShipmentLineEntry, value: any) => {
    const updated = { ...shipmentData, lines: [...shipmentData.lines] };
    updated.lines[idx] = { ...updated.lines[idx], [field]: value };
    if (field === 'qtyShipped' && shipmentData.quickAccept) {
      updated.lines[idx].qtyAccepted = value;
    }
    onShipmentDataChange(updated);
  };

  const handleQuickAccept = (checked: boolean) => {
    const updated = { ...shipmentData, quickAccept: checked, lines: [...shipmentData.lines] };
    if (checked) {
      updated.lines = updated.lines.map(l => ({ ...l, qtyAccepted: l.qtyShipped, accepted: true }));
    }
    onShipmentDataChange(updated);
  };

  const totalShipping = shipmentData.lines.reduce((s, l) => s + l.qtyShipped, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Record shipment details and customer acceptance. Use "Quick Accept" to mark all shipped quantities as accepted.
      </p>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Ship Date</Label>
          <Input
            type="date"
            value={shipmentData.shipDate}
            onChange={(e) => onShipmentDataChange({ ...shipmentData, shipDate: e.target.value })}
          />
        </div>
        <div>
          <Label>Carrier</Label>
          <Input
            value={shipmentData.carrier}
            onChange={(e) => onShipmentDataChange({ ...shipmentData, carrier: e.target.value })}
            placeholder="e.g. FedEx, UPS"
          />
        </div>
        <div>
          <Label>Tracking Number</Label>
          <Input
            value={shipmentData.trackingNumber}
            onChange={(e) => onShipmentDataChange({ ...shipmentData, trackingNumber: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={shipmentData.quickAccept}
          onCheckedChange={handleQuickAccept}
        />
        <Label className="text-sm">Quick Accept: Customer accepts all shipped quantities</Label>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Line</TableHead>
            <TableHead>Formula</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead className="text-right">Qty Shipped</TableHead>
            <TableHead className="text-right">Qty Accepted</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipmentData.lines.map((line, idx) => (
            <TableRow key={line.lineItemId}>
              <TableCell className="font-medium">{line.lineNumber}</TableCell>
              <TableCell className="font-medium">{line.formulaCode}</TableCell>
              <TableCell className="text-right">{line.qtyAvailable.toLocaleString()}</TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  min={0}
                  max={line.qtyAvailable}
                  value={line.qtyShipped}
                  onChange={(e) => handleLineChange(idx, 'qtyShipped', parseInt(e.target.value) || 0)}
                  className="w-24 ml-auto text-right"
                />
              </TableCell>
              <TableCell className="text-right">
                {shipmentData.quickAccept ? (
                  <span className="font-medium text-green-600">{line.qtyShipped.toLocaleString()}</span>
                ) : (
                  <Input
                    type="number"
                    min={0}
                    max={line.qtyShipped}
                    value={line.qtyAccepted}
                    onChange={(e) => handleLineChange(idx, 'qtyAccepted', parseInt(e.target.value) || 0)}
                    className="w-24 ml-auto text-right"
                  />
                )}
              </TableCell>
              <TableCell>
                {line.qtyAccepted === line.qtyShipped ? (
                  <Badge className="bg-green-100 text-green-800">Accepted</Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
        <Truck className="h-5 w-5" />
        <span className="text-sm font-medium">
          {totalShipping.toLocaleString()} bottles ready to ship
        </span>
      </div>
    </div>
  );
};

export type { ShipmentData, ShipmentLineEntry };
