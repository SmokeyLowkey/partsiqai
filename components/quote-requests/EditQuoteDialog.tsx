'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  Loader2,
  AlertCircle,
  Check,
  Plus,
  Trash2,
  Send,
} from 'lucide-react';
import { QuoteRequestItemWithDetails } from '@/types/quote-request';

interface EditQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteRequestId: string;
  currentItems: QuoteRequestItemWithDetails[];
  status: string;
  onSaved: () => void;
}

interface ItemChange {
  id?: string; // undefined for new items
  partNumber: string;
  description: string;
  quantity: number;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
}

export function EditQuoteDialog({
  open,
  onOpenChange,
  quoteRequestId,
  currentItems,
  status,
  onSaved,
}: EditQuoteDialogProps) {
  const [items, setItems] = useState<ItemChange[]>([]);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open) {
      // Initialize with current items
      const initialItems: ItemChange[] = currentItems.map((item) => ({
        id: item.id,
        partNumber: item.partNumber,
        description: item.description,
        quantity: item.quantity,
        changeType: 'unchanged',
      }));
      setItems(initialItems);
      setSuccess(false);
      setError(null);
      setHasChanges(false);
    }
  }, [open, currentItems]);

  const detectChanges = (updatedItems: ItemChange[]) => {
    const changes = updatedItems.map((item) => {
      const original = currentItems.find((ci) => ci.id === item.id);
      
      if (!item.id) {
        return { ...item, changeType: 'added' as const };
      }
      
      if (!original) {
        return { ...item, changeType: 'removed' as const };
      }
      
      if (
        original.partNumber !== item.partNumber ||
        original.description !== item.description ||
        original.quantity !== item.quantity
      ) {
        return { ...item, changeType: 'modified' as const };
      }
      
      return { ...item, changeType: 'unchanged' as const };
    });

    // Check for removed items
    const removedItems = currentItems.filter(
      (ci) => !updatedItems.find((item) => item.id === ci.id)
    );
    removedItems.forEach((removed) => {
      changes.push({
        id: removed.id,
        partNumber: removed.partNumber,
        description: removed.description,
        quantity: removed.quantity,
        changeType: 'removed',
      });
    });

    const hasAnyChanges = changes.some((c) => c.changeType !== 'unchanged');
    setHasChanges(hasAnyChanges);
    return changes;
  };

  const updateItem = (index: number, field: keyof ItemChange, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    const withChanges = detectChanges(updated);
    setItems(withChanges);
  };

  const addItem = () => {
    const newItem: ItemChange = {
      partNumber: '',
      description: '',
      quantity: 1,
      changeType: 'added',
    };
    const updated = [...items, newItem];
    setItems(updated);
    setHasChanges(true);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    const withChanges = detectChanges(updated);
    setItems(withChanges);
  };

  const handleSave = async (notifySuppliers: boolean = false) => {
    // Validate
    const activeItems = items.filter((item) => item.changeType !== 'removed');
    if (activeItems.length === 0) {
      setError('Quote request must have at least one item');
      return;
    }

    const invalidItems = activeItems.filter(
      (item) => !item.partNumber.trim() || !item.description.trim() || item.quantity < 1
    );
    if (invalidItems.length > 0) {
      setError('All items must have part number, description, and quantity >= 1');
      return;
    }

    if (notifySuppliers) {
      setNotifying(true);
    } else {
      setSaving(true);
    }
    setError(null);

    try {
      // Save items
      const response = await fetch(
        `/api/quote-requests/${quoteRequestId}/update-items`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: activeItems.map((item) => ({
              id: item.id,
              partNumber: item.partNumber,
              description: item.description,
              quantity: item.quantity,
            })),
            removedItemIds: items
              .filter((item) => item.changeType === 'removed' && item.id)
              .map((item) => item.id),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save changes');
      }

      // If notifying suppliers, send notifications
      if (notifySuppliers && hasChanges) {
        const notifyResponse = await fetch(
          `/api/quote-requests/${quoteRequestId}/notify-changes`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              changes: items.filter((item) => item.changeType !== 'unchanged'),
            }),
          }
        );

        if (!notifyResponse.ok) {
          const data = await notifyResponse.json();
          throw new Error(data.error || 'Failed to notify suppliers');
        }
      }

      setSuccess(true);

      // Close dialog and refresh after short delay
      setTimeout(() => {
        onOpenChange(false);
        onSaved();
      }, 2000);
    } catch (error: any) {
      console.error('Error saving quote request:', error);
      setError(error.message);
    } finally {
      setSaving(false);
      setNotifying(false);
    }
  };

  const getChangeIcon = (changeType: ItemChange['changeType']) => {
    switch (changeType) {
      case 'added':
        return <Badge className="bg-green-100 text-green-700 border-green-200">+ Added</Badge>;
      case 'removed':
        return <Badge className="bg-red-100 text-red-700 border-red-200">- Removed</Badge>;
      case 'modified':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Modified</Badge>;
      default:
        return null;
    }
  };

  const canNotifySuppliers = status !== 'DRAFT' && hasChanges;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quote Request Items</DialogTitle>
          <DialogDescription>
            Add, remove, or modify parts in this quote request. Changes can be saved and optionally notify suppliers.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              Changes saved successfully{notifying && ' and suppliers notified'}
            </AlertDescription>
          </Alert>
        )}

        {/* Items List */}
        <div className="space-y-4">
          {items.filter((item) => item.changeType !== 'removed').map((item, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 space-y-3 relative"
            >
              {/* Change Badge */}
              {item.changeType !== 'unchanged' && (
                <div className="absolute top-2 right-2">
                  {getChangeIcon(item.changeType)}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`part-${index}`}>Part Number *</Label>
                  <Input
                    id={`part-${index}`}
                    value={item.partNumber}
                    onChange={(e) => updateItem(index, 'partNumber', e.target.value)}
                    placeholder="Enter part number"
                    disabled={saving || notifying || success}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`desc-${index}`}>Description *</Label>
                  <Input
                    id={`desc-${index}`}
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    placeholder="Enter description"
                    disabled={saving || notifying || success}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`qty-${index}`}>Quantity *</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`qty-${index}`}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      disabled={saving || notifying || success}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={saving || notifying || success || items.filter(i => i.changeType !== 'removed').length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add Item Button */}
          <Button
            variant="outline"
            onClick={addItem}
            disabled={saving || notifying || success}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Part
          </Button>
        </div>

        {/* Change Summary */}
        {hasChanges && (
          <div className="border-t pt-4 space-y-2">
            <h4 className="font-medium text-sm">Change Summary</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              {items.filter((i) => i.changeType === 'added').length > 0 && (
                <p className="text-green-700">
                  • {items.filter((i) => i.changeType === 'added').length} item(s) added
                </p>
              )}
              {items.filter((i) => i.changeType === 'removed').length > 0 && (
                <p className="text-red-700">
                  • {items.filter((i) => i.changeType === 'removed').length} item(s) removed
                </p>
              )}
              {items.filter((i) => i.changeType === 'modified').length > 0 && (
                <p className="text-blue-700">
                  • {items.filter((i) => i.changeType === 'modified').length} item(s) modified
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving || notifying}
          >
            Cancel
          </Button>
          {canNotifySuppliers && (
            <Button
              onClick={() => handleSave(true)}
              disabled={!hasChanges || saving || notifying || success}
            >
              {notifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Notifying Suppliers...
                </>
              ) : success ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Saved & Notified
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Save & Notify Suppliers
                </>
              )}
            </Button>
          )}
          <Button
            onClick={() => handleSave(false)}
            disabled={!hasChanges || saving || notifying || success}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : success ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
