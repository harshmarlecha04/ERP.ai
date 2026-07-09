import { format } from 'date-fns';
import { parseDateString, formatET } from "@/utils/dateUtils";

// Generic CSV export utility
export const exportToCSV = (data: any[], filename: string, headers?: string[]) => {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Auto-generate headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    csvHeaders.join(','),
    ...data.map(row => 
      csvHeaders.map(header => {
        const value = row[header];
        // Handle values that contain commas, quotes, or newlines
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${formatET(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Customer Orders Export
export const exportCustomerOrders = (orders: any[], filename = 'customer_orders') => {
  const exportData = orders.map(order => ({
    'Order Number': order.order_number,
    'Customer': order.customer_name,
    'Formula Code': order.formula_code,
    'Formula Name': order.formula_name,
    'Bottles Ordered': order.bottles_ordered,
    'Bottle Size': order.bottle_size,
    'Priority': order.priority,
    'Status': order.status,
    'Progress': `${order.progress || 0}%`,
    'Created Date': order.created_at ? formatET(order.created_at, 'yyyy-MM-dd') : '',
    'Due Date': order.due_date ? formatET(order.due_date, 'yyyy-MM-dd') : '',
  }));

  exportToCSV(exportData, filename);
};

// Production Schedule Export
export const exportProductionSchedule = (items: any[], filename = 'production_schedule') => {
  const exportData = items.map(item => ({
    'Schedule Date': item.schedule_date ? formatET(item.schedule_date, 'yyyy-MM-dd') : '',
    'Formula Code': item.formula_code,
    'Formula Name': item.formula_name,
    'Batches': item.batches,
    'Total Required (kg)': item.total_required_kg,
    'Materials OK': item.materials_ok ? 'Yes' : 'No',
    'Current Stage': item.current_stage || 'Scheduled',
    'Actual Yield (kg)': item.actual_yield_kg || '',
    'Bottles Packed': item.bottles_packed || '',
    'Yield Variance (%)': item.yield_variance_percent || '',
  }));

  exportToCSV(exportData, filename);
};

// Quality Control Export
export const exportQualityData = (batches: any[], filename = 'quality_control') => {
  const exportData = batches.map(batch => ({
    'Formula Code': batch.formula_code,
    'Formula Name': batch.formula_name,
    'Batches': batch.batch_count,
    'Completed Date': batch.completed_at ? formatET(batch.completed_at, 'yyyy-MM-dd') : '',
    'Total Produced (qty)': batch.total_produced_qty,
    'Actual Yield (kg)': batch.actual_yield_kg || '',
    'Gummies Produced': batch.actual_gummies_produced || '',
    'Bottles Packed': batch.bottles_packed || '',
    'Yield Variance (%)': batch.yield_variance_percent || '',
    'Wastage (gummies)': batch.wastage_gummies || '',
    'Status': batch.status,
  }));

  exportToCSV(exportData, filename);
};

// Purchase Orders Export
export const exportPurchaseOrders = (pos: any[], includeFinancial = false, filename = 'purchase_orders') => {
  const exportData = pos.map(po => {
    const baseData: any = {
      'PO Number': po.po_number,
      'Vendor': po.vendor_name,
      'Ingredient': po.ingredient_name,
      'Quantity': po.quantity,
      'UOM': po.uom,
      'Ordered Date': po.ordered_date ? formatET(po.ordered_date, 'yyyy-MM-dd') : '',
      'Expected Delivery': po.expected_delivery ? formatET(po.expected_delivery, 'yyyy-MM-dd') : '',
      'Status': po.status,
      'Tracking': po.tracking_number || '',
    };

    if (includeFinancial) {
      baseData['Invoice Total'] = po.invoice_total || '';
    }

    return baseData;
  });

  exportToCSV(exportData, filename);
};

// Profitability Export
export const exportProfitabilityReport = (data: any[], filename = 'profitability_report') => {
  exportToCSV(data, filename);
};

// Packaging Inventory Export
export const exportPackagingInventory = (items: any[], filename = 'packaging_inventory') => {
  const exportData = items.map(item => ({
    'Category': item.category,
    'Item Name': item.item_name,
    'SKU': item.sku || '',
    'On Hand': item.on_hand || 0,
    'Min Level': item.min_level || 0,
    'UOM': item.uom,
    'Location': item.location || '',
    'Description': item.description || '',
  }));

  exportToCSV(exportData, filename);
};

// Material Requirements Export
export const exportMaterialRequirements = (requirements: any[], filename = 'material_requirements') => {
  const exportData = requirements.map(req => ({
    'Material Code': req.material_code,
    'Material Name': req.material_name,
    'Supplier': req.supplier || '',
    'Total Required (kg)': req.total_required_kg,
    'Current Inventory (kg)': req.current_inventory_kg,
    'Reserved (kg)': req.reserved_kg,
    'Available (kg)': req.available_kg,
    'On Order (kg)': req.on_order_kg,
    'Net Shortage (kg)': req.net_shortage_kg,
    'Net After Orders (kg)': req.net_after_orders_kg,
    'Suggested Order (kg)': req.suggested_order_kg,
  }));

  exportToCSV(exportData, filename);
};

// Raw Materials Export
export const exportRawMaterials = (materials: any[], filename = 'raw_materials') => {
  const exportData = materials.map(material => ({
    'Code': material.code,
    'Name': material.name,
    'Supplier': material.supplier || '',
    'UOM': material.uom,
    'Total Quantity (kg)': material.total_quantity || 0,
    'Reserved (kg)': material.reserved_quantity || 0,
    'Available (kg)': material.available_quantity || 0,
  }));

  exportToCSV(exportData, filename);
};