import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComprehensiveMaterialStatus } from '@/hooks/useComprehensiveMaterialCheck';
import { format } from 'date-fns';
import { formatET } from "@/utils/dateUtils";

interface MaterialShortageExportProps {
  materialStatus: ComprehensiveMaterialStatus;
  orderDetails: {
    orderNumber: string;
    batchesNeeded: number;
    bottleSize: number;
  };
}

export const MaterialShortageExport: React.FC<MaterialShortageExportProps> = ({
  materialStatus,
  orderDetails,
}) => {
  const handleExport = () => {
    const shortageData: any[] = [];

    // Add ingredient shortages
    if (materialStatus.ingredients?.shortages) {
      materialStatus.ingredients.shortages.forEach((ingredient) => {
        shortageData.push({
          Category: 'Raw Material',
          Item: ingredient.ingredient_name,
          'Material Code': ingredient.ingredient_id,
          'Available (kg)': ingredient.available_kg,
          'Required (kg)': ingredient.required_kg,
          'Shortage (kg)': ingredient.shortage_kg,
          'Max Batches Possible': ingredient.max_batches_from_ingredient,
          Priority: 'High',
        });
      });
    }

    // Add packaging shortages
    if (materialStatus.bottles && materialStatus.bottles.status !== 'available') {
      shortageData.push({
        Category: 'Packaging',
        Item: `Bottles (${orderDetails.bottleSize}ct)`,
        'Material Code': '',
        Available: materialStatus.bottles.available,
        Required: materialStatus.bottles.needed,
        Shortage: materialStatus.bottles.shortage,
        'Max Batches Possible': '-',
        Priority: materialStatus.bottles.status === 'critical' ? 'Critical' : 'Medium',
      });
    }

    if (materialStatus.caps && materialStatus.caps.status !== 'available') {
      shortageData.push({
        Category: 'Packaging',
        Item: 'Caps',
        'Material Code': '',
        Available: materialStatus.caps.available,
        Required: materialStatus.caps.needed,
        Shortage: materialStatus.caps.shortage,
        'Max Batches Possible': '-',
        Priority: materialStatus.caps.status === 'critical' ? 'Critical' : 'Medium',
      });
    }

    if (materialStatus.labels && materialStatus.labels.status !== 'available') {
      shortageData.push({
        Category: 'Packaging',
        Item: 'Labels',
        'Material Code': '',
        Available: materialStatus.labels.available,
        Required: materialStatus.labels.needed,
        Shortage: materialStatus.labels.shortage,
        'Max Batches Possible': '-',
        Priority: materialStatus.labels.status === 'critical' ? 'Critical' : 'Medium',
      });
    }

    if (shortageData.length === 0) {
      return;
    }

    // Convert to CSV
    const headers = Object.keys(shortageData[0]);
    const csvContent = [
      headers.join(','),
      ...shortageData.map((row) =>
        headers.map((header) => {
          const value = row[header]?.toString() || '';
          return value.includes(',') ? `"${value}"` : value;
        }).join(',')
      ),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `material_shortages_${orderDetails.orderNumber}_${formatET(new Date(), 'yyyy-MM-dd')}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasShortages =
    (materialStatus.ingredients?.shortages.length || 0) > 0 ||
    materialStatus.bottles?.status !== 'available' ||
    materialStatus.caps?.status !== 'available' ||
    materialStatus.labels?.status !== 'available';

  if (!hasShortages) {
    return null;
  }

  return (
    <Button onClick={handleExport} variant="outline" className="w-full">
      <Download className="mr-2 h-4 w-4" />
      Export Shortages to Excel
    </Button>
  );
};
