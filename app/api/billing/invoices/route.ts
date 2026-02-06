import { NextResponse } from "next/server"
import { getServerSession, isAdminRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

// GET /api/billing/invoices - List invoices
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    const currentUser = session?.user

    // Allow ADMIN and MANAGER to view invoices
    if (!currentUser || !["MASTER_ADMIN", "ADMIN", "MANAGER"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "10")
    const startingAfter = searchParams.get("startingAfter") || undefined

    const organization = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    if (!organization.stripeCustomerId) {
      return NextResponse.json({
        invoices: [],
        hasMore: false,
      })
    }

    // Fetch invoices from Stripe
    const stripeInvoices = await stripe.invoices.list({
      customer: organization.stripeCustomerId,
      limit,
      starting_after: startingAfter,
    })

    const invoices = stripeInvoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amountDue: invoice.amount_due / 100,
      amountPaid: invoice.amount_paid / 100,
      currency: invoice.currency,
      periodStart: invoice.period_start
        ? new Date(invoice.period_start * 1000)
        : null,
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000)
        : null,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      paidAt: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdfUrl: invoice.invoice_pdf,
      createdAt: new Date(invoice.created * 1000),
    }))

    return NextResponse.json({
      invoices,
      hasMore: stripeInvoices.has_more,
    })
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    )
  }
}
