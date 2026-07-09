import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Trash2, Download, Package, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { LabelInventoryRecord } from "@/hooks/useLabelInventory";
import { useCustomers } from "@/hooks/useCustomers";
import { formatET } from "@/utils/dateUtils";

const TIMEZONE = "America/New_York"; // EST/EDT

interface LabelInventoryTableProps {
  data: LabelInventoryRecord[];
  isLoading: boolean;
  onEdit?: (record: LabelInventoryRecord) => void;
  onDelete?: (id: string) => void;
  onExport?: () => void;
}

export const LabelInventoryTable: React.FC<LabelInventoryTableProps> = ({
  data,
  isLoading,
  onEdit,
  onDelete,
  onExport,
}) => {
  const { customers } = useCustomers();
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return "—";
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || "Unknown";
  };

  const groupedData = useMemo(() => {
    const groups = new Map<string, {
      customerId: string | null;
      customerName: string;
      products: LabelInventoryRecord[];
      totalOnHand: number;
      totalReceived: number;
      totalUsed: number;
      productCount: number;
    }>();

    data.forEach(record => {
      const customerId = record.customer_id || 'unknown';
      const customerName = getCustomerName(record.customer_id);
      
      if (!groups.has(customerId)) {
        groups.set(customerId, {
          customerId: record.customer_id,
          customerName,
          products: [],
          totalOnHand: 0,
          totalReceived: 0,
          totalUsed: 0,
          productCount: 0,
        });
      }
      
      const group = groups.get(customerId)!;
      group.products.push(record);
      group.totalOnHand += record.on_hand || 0;
      group.totalReceived += record.received_qty || 0;
      group.totalUsed += record.used_qty || 0;
      group.productCount = group.products.length;
    });

    return Array.from(groups.values()).sort((a, b) => 
      a.customerName.localeCompare(b.customerName)
    );
  }, [data, customers]);

  const toggleCustomer = (customerId: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCustomers(new Set(groupedData.map(g => g.customerId || 'unknown')));
  };

  const collapseAll = () => {
    setExpandedCustomers(new Set());
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Label Inventory Records</CardTitle>
          <Badge variant="secondary">
            {data.length} {data.length === 1 ? 'record' : 'records'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {groupedData.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={expandAll}>
                <ChevronsDownUp className="h-4 w-4 mr-1" />
                Expand All
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll}>
                <ChevronsUpDown className="h-4 w-4 mr-1" />
                Collapse All
              </Button>
            </>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Current Qty</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Package className="h-12 w-12 opacity-50" />
                    <div>
                      <p className="font-medium text-lg">No label inventory records found</p>
                      <p className="text-sm">Click "Receive Labels" to add your first label inventory record</p>
                      <p className="text-xs mt-1">Select a customer and product to get started</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              groupedData.map((group) => {
                const customerId = group.customerId || 'unknown';
                const isExpanded = expandedCustomers.has(customerId);
                
                return (
                  <React.Fragment key={customerId}>
                    {/* Parent Row - Customer */}
                    <TableRow 
                      className="bg-muted/50 hover:bg-muted cursor-pointer font-semibold border-b-2"
                      onClick={() => toggleCustomer(customerId)}
                    >
                      <TableCell colSpan={2}>
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )}
                          <span>{group.customerName}</span>
                          <Badge variant="secondary" className="ml-2">
                            {group.productCount} {group.productCount === 1 ? 'product' : 'products'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {group.productCount} {group.productCount === 1 ? 'record' : 'records'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {group.totalOnHand > 0 && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {group.totalOnHand.toLocaleString()}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* Empty for actions column */}
                      </TableCell>
                    </TableRow>

                    {/* Child Rows - Products */}
                    {isExpanded && group.products.map((record) => (
                      <TableRow key={record.id} className="bg-background">
                        <TableCell className="pl-10 text-muted-foreground">
                          {/* Indented - empty for customer name */}
                        </TableCell>
                        <TableCell>
                          {record.product_name || record.customer_product}
                        </TableCell>
                        <TableCell>
                          {formatET(record.date, "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.on_hand !== undefined && record.on_hand !== null ? (
                            <Badge 
                              variant="secondary" 
                              className={record.on_hand > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                            >
                              {record.on_hand.toLocaleString()}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {onEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(record);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {onDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(record.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};