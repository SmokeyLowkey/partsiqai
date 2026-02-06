'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Filter,
  Package,
  ShoppingCart,
  Eye,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Part {
  id: string;
  partNumber: string;
  description: string;
  category: string | null;
  subcategory: string | null;
  price: number;
  stockQuantity: number;
  availability: string;
  compatibility: any;
  bestPrice: {
    price: number;
    supplierId: string;
    supplierName: string;
    leadTime: number | null;
  } | null;
  supplierCount: number;
}

interface PicklistItem {
  part: Part;
  quantity: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CatalogPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [parts, setParts] = useState<Part[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAvailability, setSelectedAvailability] = useState('all');

  // Picklist state
  const [picklist, setPicklist] = useState<PicklistItem[]>([]);
  const [isPicklistOpen, setIsPicklistOpen] = useState(false);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch parts from API
  const fetchParts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedAvailability !== 'all') params.set('availability', selectedAvailability);
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());

      const response = await fetch(`/api/catalog/parts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setParts(data.parts);
        setPagination(data.pagination);
        setCategories(data.categories);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load parts catalog',
        });
      }
    } catch (error) {
      console.error('Error fetching parts:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load parts catalog',
      });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, selectedCategory, selectedAvailability, pagination.page, pagination.limit, toast]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearch, selectedCategory, selectedAvailability]);

  // Picklist functions
  const addToPicklist = (part: Part) => {
    setPicklist((prev) => {
      const existing = prev.find((item) => item.part.id === part.id);
      if (existing) {
        return prev.map((item) =>
          item.part.id === part.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { part, quantity: 1 }];
    });
    toast({
      title: 'Added to Picklist',
      description: `${part.partNumber} added to your picklist`,
    });
  };

  const updatePicklistQuantity = (partId: string, delta: number) => {
    setPicklist((prev) => {
      return prev
        .map((item) => {
          if (item.part.id === partId) {
            const newQuantity = item.quantity + delta;
            if (newQuantity <= 0) return null;
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter(Boolean) as PicklistItem[];
    });
  };

  const removeFromPicklist = (partId: string) => {
    setPicklist((prev) => prev.filter((item) => item.part.id !== partId));
  };

  const clearPicklist = () => {
    setPicklist([]);
  };

  const getPicklistTotal = () => {
    return picklist.reduce((total, item) => {
      const price = item.part.bestPrice?.price || item.part.price;
      return total + price * item.quantity;
    }, 0);
  };

  const getPicklistItemCount = () => {
    return picklist.reduce((total, item) => total + item.quantity, 0);
  };

  // Create quote request from picklist
  const handleCreateQuote = async () => {
    if (picklist.length === 0) return;

    setIsCreatingQuote(true);
    try {
      const response = await fetch('/api/catalog/picklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: picklist.map((item) => ({
            partId: item.part.id,
            quantity: item.quantity,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Quote Created',
          description: `Quote ${data.quoteRequest.quoteNumber} created with ${data.quoteRequest.itemCount} parts`,
        });
        clearPicklist();
        setIsPicklistOpen(false);
        router.push(`/customer/quote-requests/${data.quoteRequest.id}`);
      } else {
        const errorData = await response.json();
        toast({
          variant: 'destructive',
          title: 'Failed to Create Quote',
          description: errorData.error || 'Failed to create quote request',
        });
      }
    } catch (error) {
      console.error('Error creating quote:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create quote request',
      });
    } finally {
      setIsCreatingQuote(false);
    }
  };

  const getAvailabilityBadge = (availability: string) => {
    switch (availability) {
      case 'In Stock':
        return <Badge className="bg-green-600 text-white">{availability}</Badge>;
      case 'Limited Stock':
        return <Badge className="bg-yellow-600 text-white">{availability}</Badge>;
      default:
        return <Badge variant="secondary">{availability}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parts Catalog</h1>
          <p className="text-muted-foreground">
            Browse and search our comprehensive parts inventory
            {pagination.total > 0 && ` (${pagination.total} parts)`}
          </p>
        </div>
        <Sheet open={isPicklistOpen} onOpenChange={setIsPicklistOpen}>
          <SheetTrigger asChild>
            <Button className="relative">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Picklist
              {picklist.length > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-green-600">
                  {getPicklistItemCount()}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[540px]">
            <SheetHeader>
              <SheetTitle>Your Picklist</SheetTitle>
              <SheetDescription>
                {picklist.length === 0
                  ? 'Add parts to your picklist to create a quote request'
                  : `${getPicklistItemCount()} item${getPicklistItemCount() !== 1 ? 's' : ''} in your picklist`}
              </SheetDescription>
            </SheetHeader>

            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {picklist.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Your picklist is empty</p>
                  <p className="text-sm">Browse the catalog and add parts</p>
                </div>
              ) : (
                picklist.map((item) => (
                  <div
                    key={item.part.id}
                    className="flex items-start gap-3 p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.part.partNumber}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {item.part.description}
                      </p>
                      <p className="text-sm font-medium text-green-600">
                        ${(
                          (item.part.bestPrice?.price || item.part.price) *
                          item.quantity
                        ).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updatePicklistQuantity(item.part.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updatePicklistQuantity(item.part.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={() => removeFromPicklist(item.part.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {picklist.length > 0 && (
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Estimated Total</span>
                  <span className="text-green-600">${getPicklistTotal().toFixed(2)}</span>
                </div>
                <SheetFooter className="gap-2">
                  <Button variant="outline" onClick={clearPicklist}>
                    Clear All
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleCreateQuote}
                    disabled={isCreatingQuote}
                  >
                    {isCreatingQuote ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Create Quote Request
                      </>
                    )}
                  </Button>
                </SheetFooter>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by part number, description..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedAvailability} onValueChange={setSelectedAvailability}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="in-stock">In Stock</SelectItem>
                <SelectItem value="limited">Limited Stock</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchParts} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : parts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Parts Found</h3>
            <p className="text-muted-foreground">
              {debouncedSearch || selectedCategory !== 'all' || selectedAvailability !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'No parts have been added to the catalog yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Parts Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {parts.map((part) => (
              <Card
                key={part.id}
                className="bg-card border-border hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg text-foreground">
                        {part.partNumber}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground line-clamp-2">
                        {part.description}
                      </CardDescription>
                    </div>
                    {getAvailabilityBadge(part.availability)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {part.category && (
                    <div>
                      <p className="text-sm font-medium text-foreground">Category</p>
                      <p className="text-sm text-muted-foreground">{part.category}</p>
                    </div>
                  )}

                  {part.compatibility && (
                    <div>
                      <p className="text-sm font-medium text-foreground">Compatibility</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {typeof part.compatibility === 'string'
                          ? part.compatibility
                          : JSON.stringify(part.compatibility)}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Stock: {part.stockQuantity}</span>
                    {part.supplierCount > 0 && (
                      <span>{part.supplierCount} supplier{part.supplierCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      {part.bestPrice ? (
                        <>
                          <p className="text-2xl font-bold text-green-600">
                            ${part.bestPrice.price.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            via {part.bestPrice.supplierName}
                          </p>
                        </>
                      ) : (
                        <p className="text-2xl font-bold text-foreground">
                          ${part.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/customer/catalog/${part.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => addToPicklist(part)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} parts
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
