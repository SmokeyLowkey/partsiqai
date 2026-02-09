import { QuoteStatus, ItemAvailability, QuoteThreadStatus, UserRole, ThreadRole } from '@prisma/client';

export interface QuoteRequestWithDetails {
  id: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  description: string | null;
  notes: string | null;
  requestDate: Date;
  expiryDate: Date | null;
  responseDate: Date | null;
  totalAmount: number | null;
  createdAt: Date;
  updatedAt: Date;

  // Approval fields
  requiresApproval: boolean;
  approvedById: string | null;
  approvedAt: Date | null;
  approvalNotes: string | null;
  selectedSupplierId: string | null;

  // Manager takeover fields
  managerTakeoverAt: Date | null;
  managerTakeoverId: string | null;

  // Relations
  vehicle: VehicleSummary | null;
  supplier: SupplierSummary | null;
  additionalSuppliers: SupplierSummary[];
  selectedSupplier: SupplierSummary | null;
  items: QuoteRequestItemWithDetails[];
  emailThreads: QuoteRequestEmailThreadWithDetails[];
  createdBy: UserSummary;
  approvedBy: UserSummary | null;
  managerTakeover: UserSummary | null;
  pickList: PickListSummary | null;
}

export interface VehicleSummary {
  id: string;
  make: string;
  model: string;
  year: number | null;
  serialNumber: string | null;
  vehicleId: string | null;
}

export interface SupplierSummary {
  id: string;
  name: string;
  email: string | null;
  contactPerson: string | null;
  phone: string | null;
  rating: number | null;
}

export interface UserSummary {
  id: string;
  name: string | null;
  email: string;
  role?: UserRole;
}

export interface PickListSummary {
  id: string;
  name: string;
}

export interface QuoteRequestItemWithDetails {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  availability: ItemAvailability;
  leadTime: number | null;
  supplierNotes: string | null;
  supplierId: string | null;
  supplier: SupplierSummary | null;
  supplierQuotes: SupplierQuoteItemWithDetails[];
  isAlternative: boolean;
  alternativeReason: string | null;
  isSuperseded: boolean;
  originalPartNumber: string | null;
  supersessionNotes: string | null;
}

// Per-supplier pricing for an item
export interface SupplierQuoteItemWithDetails {
  id: string;
  supplierId: string;
  supplier: SupplierSummary;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  availability: ItemAvailability;
  leadTimeDays: number | null;
  supplierPartNumber: string | null;
  notes: string | null;
  validUntil: Date | null;
  isSelected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteRequestEmailThreadWithDetails {
  id: string;
  supplierId: string;
  supplier: SupplierSummary;
  isPrimary: boolean;
  status: QuoteThreadStatus;
  responseDate: Date | null;
  quotedAmount: number | null;
  threadRole: ThreadRole;
  parentThreadId: string | null;
  visibleToCreator: boolean;
  takeoverAt: Date | null;
  takeoverById: string | null;
  emailThread: EmailThreadSummary;
}

export interface EmailThreadSummary {
  id: string;
  subject: string | null;
  status: string;
  messages: EmailMessageSummary[];
}

export interface EmailAttachmentSummary {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface EmailMessageSummary {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  subject: string | null;
  body: string;
  sentAt: Date | null;
  receivedAt: Date | null;
  attachments: EmailAttachmentSummary[];
}

export interface SupplierComparison {
  supplierId: string;
  supplierName: string;
  responded: boolean;
  quotedAmount: number | null;
  responseDate: Date | null;
  leadTime: number | null;
}

// Item-level price comparison across all suppliers
export interface ItemPriceComparison {
  itemId: string;
  partNumber: string;
  description: string;
  quantity: number;
  supplierPrices: {
    supplierId: string;
    supplierName: string;
    unitPrice: number;
    totalPrice: number;
    availability: ItemAvailability;
    leadTimeDays: number | null;
    isLowestPrice: boolean;
    isSelected: boolean;
  }[];
  lowestPrice: number | null;
  highestPrice: number | null;
  priceDifference: number | null; // difference between highest and lowest
}

export interface QuoteRequestListItem {
  id: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  requestDate: Date;
  totalAmount: number | null;
  itemCount: number;
  supplier: SupplierSummary | null;
  vehicle: VehicleSummary | null;
  createdAt: Date;
}
