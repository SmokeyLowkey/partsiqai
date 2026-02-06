'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { QuoteRequestItemWithDetails } from '@/types/quote-request';

interface QuoteItemsTableProps {
  items: QuoteRequestItemWithDetails[];
  showPrices?: boolean;
  editable?: boolean;
  quoteRequestId?: string;
  onItemsUpdated?: () => void;
}

export function QuoteItemsTable({
  items,
  showPrices = true,
  editable = false,
  quoteRequestId,
  onItemsUpdated,
}: QuoteItemsTableProps) {
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setEditedQuantities((prev) => ({
      ...prev,
      [itemId]: quantity,
    }));
  };

  const handleQuantityBlur = async (item: QuoteRequestItemWithDetails) => {
    const newQuantity = editedQuantities[item.id];
    if (newQuantity === undefined || newQuantity === item.quantity) {
      // No change or no edit made
      setEditedQuantities((prev) => {
        const { [item.id]: _, ...rest } = prev;
        return rest;
      });
      return;
    }

    if (newQuantity < 1) {
      // Reset to original
      setEditedQuantities((prev) => {
        const { [item.id]: _, ...rest } = prev;
        return rest;
      });
      return;
    }

    // Save the change
    setSavingItemId(item.id);
    try {
      const response = await fetch(`/api/quote-requests/${quoteRequestId}/update-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id,
            partNumber: i.partNumber,
            description: i.description,
            quantity: i.id === item.id ? newQuantity : i.quantity,
          })),
          removedItemIds: [],
        }),
      });

      if (response.ok) {
        onItemsUpdated?.();
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    } finally {
      setSavingItemId(null);
      setEditedQuantities((prev) => {
        const { [item.id]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (items.length <= 1) return; // Don't allow deleting last item

    setDeletingItemId(itemId);
    try {
      const remainingItems = items.filter((i) => i.id !== itemId);
      const response = await fetch(`/api/quote-requests/${quoteRequestId}/update-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: remainingItems.map((i) => ({
            id: i.id,
            partNumber: i.partNumber,
            description: i.description,
            quantity: i.quantity,
          })),
          removedItemIds: [itemId],
        }),
      });

      if (response.ok) {
        onItemsUpdated?.();
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setDeletingItemId(null);
    }
  };
  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const totalValue = items.reduce((sum, item) => {
    if (item.totalPrice) {
      return sum + item.totalPrice;
    }
    return sum;
  }, 0);

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">Quote Items</h4>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-medium">Part Number</TableHead>
              <TableHead className="font-medium">Description</TableHead>
              <TableHead className="font-medium text-center">Quantity</TableHead>
              {showPrices && (
                <>
                  <TableHead className="font-medium text-right">
                    Unit Price
                  </TableHead>
                  <TableHead className="font-medium text-right">Total</TableHead>
                </>
              )}
              {editable && <TableHead className="font-medium w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showPrices ? (editable ? 6 : 5) : (editable ? 4 : 3)}
                  className="text-center text-muted-foreground py-8"
                >
                  No items in this quote request
                </TableCell>
              </TableRow>
            ) : (
              <>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      {item.partNumber}
                    </TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-center">
                      {editable ? (
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            min="1"
                            value={editedQuantities[item.id] ?? item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(item.id, parseInt(e.target.value) || 1)
                            }
                            onBlur={() => handleQuantityBlur(item)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-20 h-8 text-center"
                            disabled={savingItemId === item.id}
                          />
                          {savingItemId === item.id && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      ) : (
                        item.quantity
                      )}
                    </TableCell>
                    {showPrices && (
                      <>
                        <TableCell className="text-right">
                          {formatPrice(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPrice(item.totalPrice)}
                        </TableCell>
                      </>
                    )}
                    {editable && (
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={deletingItemId === item.id || items.length <= 1}
                          title={items.length <= 1 ? 'Cannot delete last item' : 'Remove item'}
                        >
                          {deletingItemId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {showPrices && totalValue > 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell
                      colSpan={editable ? 5 : 4}
                      className="text-right font-medium"
                    >
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatPrice(totalValue)}
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
