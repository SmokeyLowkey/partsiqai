'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Star,
  Truck,
  Package,
  Edit,
  Trash2,
  Search,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface Supplier {
  id: string;
  supplierId: string;
  name: string;
  type: 'OEM_DIRECT' | 'DISTRIBUTOR' | 'AFTERMARKET' | 'LOCAL_DEALER' | 'ONLINE_RETAILER';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED';
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  rating?: number;
  deliveryRating?: number;
  qualityRating?: number;
  avgDeliveryTime?: number;
  paymentTerms?: string;
}

interface FormErrors {
  name?: string;
  supplierId?: string;
  email?: string;
  website?: string;
}

export default function SuppliersPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState<Partial<Supplier>>({
    type: 'DISTRIBUTOR',
    status: 'ACTIVE',
    country: 'USA',
  });

  // Load suppliers on mount
  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/suppliers');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to load suppliers',
          description: 'Please refresh the page to try again.',
        });
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
      toast({
        variant: 'destructive',
        title: 'Connection error',
        description: 'Could not connect to the server.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Required fields
    if (!formData.name?.trim()) {
      errors.name = 'Supplier name is required';
    }

    if (!formData.supplierId?.trim()) {
      errors.supplierId = 'Supplier ID is required';
    } else if (!/^[A-Za-z0-9-_]+$/.test(formData.supplierId)) {
      errors.supplierId = 'Supplier ID can only contain letters, numbers, hyphens, and underscores';
    }

    // Email validation
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
      }
    }

    // Website validation (optional, but if provided should be valid)
    if (formData.website && formData.website.trim()) {
      // Allow domain-only entries (we'll add https:// on the backend)
      const websiteRegex = /^(https?:\/\/)?[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+/;
      if (!websiteRegex.test(formData.website)) {
        errors.website = 'Please enter a valid website (e.g., example.com or https://example.com)';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      type: 'DISTRIBUTOR',
      status: 'ACTIVE',
      country: 'USA',
    });
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateForm()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fix the errors in the form before submitting.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditDialogOpen && selectedSupplier 
        ? `/api/suppliers/${selectedSupplier.id}`
        : '/api/suppliers';
      
      const method = isEditDialogOpen && selectedSupplier ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        if (isEditDialogOpen && selectedSupplier) {
          setSuppliers(suppliers.map(s => s.id === selectedSupplier.id ? data.supplier : s));
          setIsEditDialogOpen(false);
          toast({
            title: 'Supplier updated successfully',
            description: `${data.supplier.name} has been updated.`,
          });
        } else {
          setSuppliers([data.supplier, ...suppliers]);
          setIsAddDialogOpen(false);
          toast({
            title: 'Supplier added successfully',
            description: `${data.supplier.name} has been added to your supplier network.`,
          });
        }
        resetForm();
        setSelectedSupplier(null);
      } else if (response.status === 409) {
        setFormErrors({ supplierId: 'This Supplier ID already exists' });
        toast({
          variant: 'destructive',
          title: 'Duplicate Supplier ID',
          description: 'A supplier with this ID already exists. Please use a different ID.',
        });
      } else if (response.status === 400) {
        // Parse validation errors from server
        const errorMessages = data.details?.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
        toast({
          variant: 'destructive',
          title: 'Invalid Data',
          description: errorMessages || data.error || 'Please check your input and try again.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: isEditDialogOpen ? 'Failed to update supplier' : 'Failed to add supplier',
          description: data.error || 'An unexpected error occurred.',
        });
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Could not connect to the server. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData(supplier);
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedSupplier) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuppliers(suppliers.filter(s => s.id !== selectedSupplier.id));
        setIsDeleteDialogOpen(false);
        setSelectedSupplier(null);
        toast({
          title: 'Supplier deleted',
          description: `${selectedSupplier.name} has been removed from your supplier network.`,
        });
      } else {
        const data = await response.json();
        toast({
          variant: 'destructive',
          title: 'Failed to delete supplier',
          description: data.error || 'An unexpected error occurred.',
        });
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Could not connect to the server. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch =
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.supplierId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || supplier.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Suppliers</h1>
          <p className="text-muted-foreground">Manage your supplier network and contacts</p>
        </div>
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
              <DialogDescription>
                Enter the supplier information to add them to your network
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className={formErrors.name ? 'text-destructive' : ''}>
                    Supplier Name *
                  </Label>
                  <Input
                    id="name"
                    placeholder="Company Name"
                    value={formData.name || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                    }}
                    className={formErrors.name ? 'border-destructive' : ''}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {formErrors.name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplierId" className={formErrors.supplierId ? 'text-destructive' : ''}>
                    Supplier ID *
                  </Label>
                  <Input
                    id="supplierId"
                    placeholder="SUP-001"
                    value={formData.supplierId || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, supplierId: e.target.value.toUpperCase() });
                      if (formErrors.supplierId) setFormErrors({ ...formErrors, supplierId: undefined });
                    }}
                    className={formErrors.supplierId ? 'border-destructive' : ''}
                  />
                  {formErrors.supplierId && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {formErrors.supplierId}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Supplier Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value as Supplier['type'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OEM_DIRECT">OEM Direct</SelectItem>
                      <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
                      <SelectItem value="AFTERMARKET">Aftermarket</SelectItem>
                      <SelectItem value="LOCAL_DEALER">Local Dealer</SelectItem>
                      <SelectItem value="ONLINE_RETAILER">Online Retailer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value as Supplier['status'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  placeholder="John Smith"
                  value={formData.contactPerson || ''}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className={formErrors.email ? 'text-destructive' : ''}>
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contact@supplier.com"
                    value={formData.email || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                    }}
                    className={formErrors.email ? 'border-destructive' : ''}
                  />
                  {formErrors.email && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {formErrors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="(555) 123-4567"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className={formErrors.website ? 'text-destructive' : ''}>
                  Website
                </Label>
                <Input
                  id="website"
                  placeholder="example.com or https://example.com"
                  value={formData.website || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, website: e.target.value });
                    if (formErrors.website) setFormErrors({ ...formErrors, website: undefined });
                  }}
                  className={formErrors.website ? 'border-destructive' : ''}
                />
                {formErrors.website && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.website}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  You can enter just the domain (e.g., brandt.ca) - we&apos;ll add https:// automatically
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Chicago"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="IL"
                    value={formData.state || ''}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    placeholder="60601"
                    value={formData.zipCode || ''}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Textarea
                  id="paymentTerms"
                  placeholder="Net 30, credit card accepted..."
                  value={formData.paymentTerms || ''}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    resetForm();
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Supplier'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers by name, ID, or email..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredSuppliers.map((supplier) => (
          <Card key={supplier.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{supplier.name}</CardTitle>
                  <CardDescription className="text-xs">{supplier.supplierId}</CardDescription>
                </div>
                <Badge
                  variant={
                    supplier.status === 'ACTIVE'
                      ? 'default'
                      : supplier.status === 'INACTIVE'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {supplier.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{supplier.type}</span>
                </div>
                {supplier.contactPerson && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium">Contact:</span> {supplier.contactPerson}
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.website && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4" />
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
                {supplier.city && supplier.state && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {supplier.city}, {supplier.state}
                    </span>
                  </div>
                )}
              </div>

              {/* Ratings */}
              {(supplier.rating || supplier.deliveryRating || supplier.qualityRating) && (
                <div className="pt-4 border-t space-y-2">
                  <p className="text-xs font-medium">Performance</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {supplier.rating && (
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{supplier.rating}</span>
                        </div>
                        <p className="text-muted-foreground">Overall</p>
                      </div>
                    )}
                    {supplier.deliveryRating && (
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Truck className="h-3 w-3" />
                          <span className="font-medium">{supplier.deliveryRating}</span>
                        </div>
                        <p className="text-muted-foreground">Delivery</p>
                      </div>
                    )}
                    {supplier.qualityRating && (
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Package className="h-3 w-3" />
                          <span className="font-medium">{supplier.qualityRating}</span>
                        </div>
                        <p className="text-muted-foreground">Quality</p>
                      </div>
                    )}
                  </div>
                  {supplier.avgDeliveryTime && (
                    <p className="text-xs text-center text-muted-foreground pt-1">
                      Avg delivery: {supplier.avgDeliveryTime} days
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleEdit(supplier)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    setSelectedSupplier(supplier);
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Edit Supplier Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            resetForm();
            setSelectedSupplier(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>
              Update supplier information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Same form fields as Add dialog - omitted for brevity */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Supplier Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-supplierId">Supplier ID *</Label>
                <Input
                  id="edit-supplierId"
                  value={formData.supplierId || ''}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  disabled
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedSupplier?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Delete Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {filteredSuppliers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No suppliers found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first supplier'}
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
