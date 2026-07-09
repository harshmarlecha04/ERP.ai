import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, RotateCcw, Eye } from "lucide-react";
import { RawMaterial, RawMaterialUsageStats } from "@/types/inventory";
import { format } from "date-fns";
import { formatET } from "@/utils/dateUtils";

interface ArchivedMaterialsTableProps {
  archivedMaterials: RawMaterial[];
  usageStats: RawMaterialUsageStats[];
  onRestore: (material: RawMaterial) => void;
  onViewDetails: (material: RawMaterial) => void;
  canManage: boolean;
}

export function ArchivedMaterialsTable({
  archivedMaterials,
  usageStats,
  onRestore,
  onViewDetails,
  canManage,
}: ArchivedMaterialsTableProps) {
  const getUsageStatsForMaterial = (materialId: string) => {
    return usageStats.find(stat => stat.raw_material_id === materialId);
  };

  if (archivedMaterials.length === 0) {
    return (
      <div className="text-center py-8">
        <Archive className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No archived materials found</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Usage Count</TableHead>
            <TableHead>Total Used (kg)</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead>Archived Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {archivedMaterials.map((material) => {
            const stats = getUsageStatsForMaterial(material.id);
            return (
              <TableRow key={material.id}>
                <TableCell className="font-medium">{material.code}</TableCell>
                <TableCell>{material.name}</TableCell>
                <TableCell>{material.supplier || "N/A"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {stats?.usage_count || 0} uses
                  </Badge>
                </TableCell>
                <TableCell>
                  {stats?.total_quantity_used 
                    ? Number(stats.total_quantity_used).toFixed(2)
                    : "0.00"
                  }
                </TableCell>
                <TableCell>
                  {stats?.last_used_date 
                    ? formatET(stats.last_used_date, "MMM dd, yyyy")
                    : "Never"
                  }
                </TableCell>
                <TableCell>
                  {material.archived_at 
                    ? formatET(material.archived_at, "MMM dd, yyyy")
                    : "N/A"
                  }
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-warning border-warning">
                    <Archive className="w-3 h-3 mr-1" />
                    Archived
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(material)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRestore(material)}
                        className="text-primary hover:text-primary"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}