"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface SupplierOption {
  id: string;
  name: string;
  totalAmount?: number;
}

interface ApprovalActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteRequestId: string;
  quoteNumber: string;
  requestedBy: string;
  totalAmount?: number;
  suppliers?: SupplierOption[];
  onSuccess?: () => void;
}

export function ApprovalActionsDialog({
  open,
  onOpenChange,
  quoteRequestId,
  quoteNumber,
  requestedBy,
  totalAmount,
  suppliers = [],
  onSuccess,
}: ApprovalActionsDialogProps) {
  const [notes, setNotes] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAction = async (action: "approve" | "reject") => {
    if (action === "reject" && !notes.trim()) {
      toast({
        title: "Notes required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    if (action === "approve" && suppliers.length > 0 && !selectedSupplierId) {
      toast({
        title: "Supplier selection required",
        description: "Please select which supplier's quote to accept",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/quote-requests/${quoteRequestId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            notes,
            ...(action === "approve" && selectedSupplierId && { selectedSupplierId })
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} quote`);
      }

      const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
      
      toast({
        title: action === "approve" ? "Quote approved" : "Quote rejected",
        description:
          action === "approve"
            ? `Quote ${quoteNumber} has been approved${selectedSupplier ? ` for ${selectedSupplier.name}` : ''} and can now be converted to an order.`
            : `Quote ${quoteNumber} has been rejected and returned to ${requestedBy}.`,
      });

      setNotes("");
      setSelectedSupplierId("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : `Failed to ${action} quote`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Review Quote Request</DialogTitle>
          <DialogDescription>
            Approve or reject quote {quoteNumber} requested by {requestedBy}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {totalAmount && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Estimated Total</p>
              <p className="text-2xl font-bold">
                ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}

          {suppliers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="supplier-select">
                Select Supplier to Accept <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
              >
                <SelectTrigger id="supplier-select">
                  <SelectValue placeholder="Choose which supplier's quote to accept" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                      {supplier.totalAmount !== undefined && (
                        <span className="ml-2 text-muted-foreground">
                          (${supplier.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only the selected supplier will be able to convert this quote to an order
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="approval-notes">
              Notes {" "}
              <span className="text-destructive">*Required for rejection</span>
            </Label>
            <Textarea
              id="approval-notes"
              placeholder="Add approval notes or reason for rejection..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="destructive"
              onClick={() => handleAction("reject")}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Reject
            </Button>
            <Button
              onClick={() => handleAction("approve")}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Approve
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
