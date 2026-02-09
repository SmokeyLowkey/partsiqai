'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QuoteStatusBadge } from '@/components/quote-requests';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Filter,
  Plus,
  Eye,
  FileText,
  Truck,
  Building2,
  UserCheck,
  CheckCircle,
} from 'lucide-react';
import { QuoteStatus } from '@prisma/client';

interface QuoteRequestListItem {
  id: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  requestDate: string;
  totalAmount: number | null;
  itemCount: number;
  managerTakeoverAt: string | null;
  managerTakeoverId: string | null;
  supplier: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number | null;
  } | null;
  createdAt: string;
}

export default function QuoteRequestsPage() {
  const router = useRouter();
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchQuoteRequests();
  }, [statusFilter]);

  const fetchQuoteRequests = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/quote-requests?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setQuoteRequests(data.quoteRequests);
      }
    } catch (error) {
      console.error('Error fetching quote requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQuoteRequests();
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  // Calculate stats
  const stats = {
    draft: quoteRequests.filter((qr) => qr.status === 'DRAFT').length,
    sent: quoteRequests.filter((qr) => qr.status === 'SENT').length,
    received: quoteRequests.filter((qr) => qr.status === 'RECEIVED').length,
    approved: quoteRequests.filter((qr) => qr.status === 'APPROVED').length,
    managerReviewing: quoteRequests.filter(
      (qr) => qr.managerTakeoverAt && qr.status !== 'CONVERTED_TO_ORDER'
    ).length,
    completed: quoteRequests.filter((qr) => qr.status === 'CONVERTED_TO_ORDER').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quote Requests</h1>
          <p className="text-muted-foreground">
            Manage your quote requests and track supplier responses
          </p>
        </div>
        <Button onClick={() => router.push('/customer/ai-chat')}>
          <Plus className="h-4 w-4 mr-2" />
          New Quote Request
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Draft</p>
                <p className="text-2xl font-bold">{stats.draft}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold">{stats.sent}</p>
              </div>
              <Truck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Received
                </p>
                <p className="text-2xl font-bold">{stats.received}</p>
              </div>
              <Building2 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Approved
                </p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
              <FileText className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Manager Reviewing
                </p>
                <p className="text-2xl font-bold">{stats.managerReviewing}</p>
              </div>
              <UserCheck className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completed
                </p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search quote requests..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="CONVERTED_TO_ORDER">Converted</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Quote Requests List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading quote requests...
            </CardContent>
          </Card>
        ) : quoteRequests.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No quote requests found</p>
              <p className="text-sm mt-1">
                Create a new quote request from the AI Chat
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push('/customer/ai-chat')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Start AI Chat
              </Button>
            </CardContent>
          </Card>
        ) : (
          quoteRequests.map((qr) => (
            <Card key={qr.id} className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-foreground">
                      {qr.quoteNumber}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {qr.title} • Created {formatDate(qr.createdAt)}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <QuoteStatusBadge status={qr.status} />
                    {qr.managerTakeoverAt && qr.status !== 'CONVERTED_TO_ORDER' && (
                      <Badge className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                        <UserCheck className="h-3 w-3 mr-1" />
                        Manager Reviewing
                      </Badge>
                    )}
                    {qr.status === 'CONVERTED_TO_ORDER' && (
                      <Badge className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/customer/quote-requests/${qr.id}`)
                      }
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Supplier */}
                  <div>
                    <h4 className="font-medium mb-1 text-foreground text-sm">
                      Supplier
                    </h4>
                    {qr.supplier ? (
                      <p className="text-sm text-muted-foreground">
                        {qr.supplier.name}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No supplier selected
                      </p>
                    )}
                  </div>

                  {/* Vehicle */}
                  <div>
                    <h4 className="font-medium mb-1 text-foreground text-sm">
                      Vehicle
                    </h4>
                    {qr.vehicle ? (
                      <p className="text-sm text-muted-foreground">
                        {qr.vehicle.make} {qr.vehicle.model}
                        {qr.vehicle.year && ` (${qr.vehicle.year})`}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No vehicle
                      </p>
                    )}
                  </div>

                  {/* Quote Details */}
                  <div>
                    <h4 className="font-medium mb-1 text-foreground text-sm">
                      Details
                    </h4>
                    <div className="space-y-0.5 text-sm text-muted-foreground">
                      <p>Items: {qr.itemCount}</p>
                      <p>Total: {formatPrice(qr.totalAmount)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
