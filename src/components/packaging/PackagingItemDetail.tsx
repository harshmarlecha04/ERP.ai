import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Edit2, Save, X } from "lucide-react";
import { usePackagingItemDetail, usePackagingHistory, useUpdatePackagingItem } from "@/hooks/usePackagingInventory";
import { PackagingMovementForm } from "./PackagingMovementForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PackagingItemDetailProps {
  itemId: string;
  onBack: () => void;
}

export const PackagingItemDetail: React.FC<PackagingItemDetailProps> = ({ 
  itemId, 
  onBack 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [movementFormOpen, setMovementFormOpen] = useState(false);
  const [movementType, setMovementType] = useState<'RECEIPT' | 'USAGE' | 'ADJUSTMENT'>('RECEIPT');
  const [editValues, setEditValues] = useState<any>({});

  const { data: item, isLoading } = usePackagingItemDetail(itemId);
  const { data: history = [] } = usePackagingHistory({ item_name: item?.item_name });
  const updateItem = useUpdatePackagingItem();

  const handleEdit = () => {
    if (item) {
      setEditValues({
        description: item.description || '',
        sku: item.sku || '',
        uom: item.uom,
        location: item.location || '',
        min_level: item.min_level,
        notes: item.notes || '',
      });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (item) {
      try {
        await updateItem.mutateAsync({
          id: item.id,
          ...editValues,
        });
        setIsEditing(false);
      } catch (error) {
        console.error('Failed to update item:', error);
      }
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValues({});
  };

  const openMovementForm = (type: 'RECEIPT' | 'USAGE' | 'ADJUSTMENT') => {
    setMovementType(type);
    setMovementFormOpen(true);
  };

  const getCurrentOnHand = () => {
    return history.reduce((sum, movement) => sum + movement.qty, 0);
  };

  if (isLoading || !item) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-6 bg-muted animate-pulse rounded mb-4" />
                <div className="h-4 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{item.category}</Badge>
              <h1 className="text-2xl font-bold">{item.item_name}</h1>
            </div>
            <p className="text-muted-foreground">Item Details & Movement History</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateItem.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {updateItem.isPending ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleEdit}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">On-Hand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getCurrentOnHand()} {item.uom}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Min Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.min_level}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.location || 'Not set'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Item Details */}
      <Card>
        <CardHeader>
          <CardTitle>Item Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Description</Label>
              {isEditing ? (
                <Textarea
                  value={editValues.description}
                  onChange={(e) => setEditValues({...editValues, description: e.target.value})}
                  className="resize-none"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{item.description || 'No description'}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>SKU</Label>
              {isEditing ? (
                <Input
                  value={editValues.sku}
                  onChange={(e) => setEditValues({...editValues, sku: e.target.value})}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{item.sku || 'No SKU'}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Unit of Measure</Label>
              {isEditing ? (
                <Input
                  value={editValues.uom}
                  onChange={(e) => setEditValues({...editValues, uom: e.target.value})}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{item.uom}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              {isEditing ? (
                <Input
                  value={editValues.location}
                  onChange={(e) => setEditValues({...editValues, location: e.target.value})}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{item.location || 'Not set'}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Min Level</Label>
              {isEditing ? (
                <Input
                  type="number"
                  value={editValues.min_level}
                  onChange={(e) => setEditValues({...editValues, min_level: parseFloat(e.target.value) || 0})}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{item.min_level}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              {isEditing ? (
                <Textarea
                  value={editValues.notes}
                  onChange={(e) => setEditValues({...editValues, notes: e.target.value})}
                  className="resize-none"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{item.notes || 'No notes'}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => openMovementForm('RECEIPT')}>
          <Plus className="h-4 w-4 mr-2" />
          Receive
        </Button>
        <Button variant="outline" onClick={() => openMovementForm('USAGE')}>
          <Plus className="h-4 w-4 mr-2" />
          Use
        </Button>
        <Button variant="outline" onClick={() => openMovementForm('ADJUSTMENT')}>
          <Plus className="h-4 w-4 mr-2" />
          Adjust
        </Button>
      </div>

      {/* Movement History */}
      <Card>
        <CardHeader>
          <CardTitle>Movement Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No movements recorded for this item.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{movement.move_date}</TableCell>
                      <TableCell>
                        <Badge variant={movement.move_type === 'RECEIPT' ? 'default' : 
                                      movement.move_type === 'USAGE' ? 'destructive' : 'secondary'}>
                          {movement.move_type}
                        </Badge>
                      </TableCell>
                      <TableCell className={movement.qty < 0 ? 'text-destructive' : 'text-green-600'}>
                        {movement.qty > 0 ? '+' : ''}{movement.qty}
                      </TableCell>
                      <TableCell>{movement.vendor || '-'}</TableCell>
                      <TableCell>{movement.po || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate" title={movement.notes || ''}>
                        {movement.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Movement Form */}
      <PackagingMovementForm
        open={movementFormOpen}
        onOpenChange={setMovementFormOpen}
        movementType={movementType}
        preselectedCategory={item.category}
        preselectedItemId={item.id}
      />
    </div>
  );
};