"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, Receipt } from "lucide-react"
import { format } from "date-fns"

interface Invoice {
  id: string
  number: string | null
  status: string
  amountDue: number
  amountPaid: number
  currency: string
  periodStart: string | null
  periodEnd: string | null
  paidAt: string | null
  hostedInvoiceUrl: string | null
  invoicePdfUrl: string | null
  createdAt: string
}

interface InvoiceTableProps {
  invoices: Invoice[]
  isLoading?: boolean
}

const statusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  open: "bg-yellow-100 text-yellow-800",
  draft: "bg-gray-100 text-gray-800",
  void: "bg-red-100 text-red-800",
  uncollectible: "bg-red-100 text-red-800",
}

export function InvoiceTable({ invoices, isLoading }: InvoiceTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No invoices yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Invoices will appear here after your first payment
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell className="font-medium">
              {invoice.number || invoice.id.slice(-8).toUpperCase()}
            </TableCell>
            <TableCell>
              {format(new Date(invoice.createdAt), "MMM d, yyyy")}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {invoice.periodStart && invoice.periodEnd
                ? `${format(new Date(invoice.periodStart), "MMM d")} - ${format(new Date(invoice.periodEnd), "MMM d, yyyy")}`
                : "-"}
            </TableCell>
            <TableCell>
              ${invoice.amountPaid.toFixed(2)}{" "}
              <span className="text-muted-foreground uppercase text-xs">
                {invoice.currency}
              </span>
            </TableCell>
            <TableCell>
              <Badge
                className={statusColors[invoice.status] || "bg-gray-100"}
                variant="secondary"
              >
                {invoice.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                {invoice.hostedInvoiceUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                  >
                    <a
                      href={invoice.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {invoice.invoicePdfUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                  >
                    <a
                      href={invoice.invoicePdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
