"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Search, 
  Edit, 
  Trash2, 
  RefreshCw,
  Filter,
  Users,
  Truck,
  ShoppingCart,
  FileText,
  Crown,
} from "lucide-react";

type Organization = {
  id: string;
  name: string;
  domain: string | null;
  subscriptionTier: string;
  subscriptionStatus: string;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  maxUsers: number;
  maxVehicles: number;
  logo: string | null;
  primaryColor: string | null;
  createdAt: Date;
  _count: {
    users: number;
    vehicles: number;
    orders: number;
    quoteRequests: number;
    parts: number;
  };
};

export default function TenantsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    subscriptionTier: "STARTER",
    subscriptionStatus: "TRIAL",
    maxUsers: 5,
    maxVehicles: 10,
    primaryColor: "#3b82f6",
  });

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchOrganizations();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, tierFilter, statusFilter]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (tierFilter !== "all") params.append("subscriptionTier", tierFilter);
      if (statusFilter !== "all") params.append("subscriptionStatus", statusFilter);

      const response = await fetch(`/api/admin/tenants?${params}`);

      if (response.status === 403) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch organizations");

      const data = await response.json();
      setOrganizations(data.organizations);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch organizations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show access denied screen for non-master admins
  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-red-50 dark:bg-red-950 rounded-full p-6 mb-6">
          <Building2 className="h-12 w-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          You do not have permission to access tenant management.
          This feature is only available to Master Administrators.
        </p>
        <Badge variant="destructive" className="mb-4">Master Admin Required</Badge>
        <a href="/admin/analytics">
          <Button variant="outline">Return to Dashboard</Button>
        </a>
      </div>
    );
  }

  const handleCreateOrganization = async () => {
    try {
      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create organization");
      }

      toast({
        title: "Success",
        description: "Organization created successfully",
      });

      setShowCreateDialog(false);
      resetForm();
      fetchOrganizations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateOrganization = async () => {
    if (!selectedOrg) return;

    try {
      const response = await fetch(`/api/admin/tenants/${selectedOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update organization");
      }

      toast({
        title: "Success",
        description: "Organization updated successfully",
      });

      setShowEditDialog(false);
      setSelectedOrg(null);
      resetForm();
      fetchOrganizations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSuspendOrganization = async (orgId: string) => {
    if (!confirm("Are you sure you want to suspend this organization?")) return;

    try {
      const response = await fetch(`/api/admin/tenants/${orgId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to suspend organization");

      toast({
        title: "Success",
        description: "Organization suspended successfully",
      });

      fetchOrganizations();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to suspend organization",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (org: Organization) => {
    setSelectedOrg(org);
    setFormData({
      name: org.name,
      domain: org.domain || "",
      subscriptionTier: org.subscriptionTier,
      subscriptionStatus: org.subscriptionStatus,
      maxUsers: org.maxUsers,
      maxVehicles: org.maxVehicles,
      primaryColor: org.primaryColor || "#3b82f6",
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      domain: "",
      subscriptionTier: "STARTER",
      subscriptionStatus: "TRIAL",
      maxUsers: 5,
      maxVehicles: 10,
      primaryColor: "#3b82f6",
    });
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case "ENTERPRISE":
        return "bg-purple-500";
      case "GROWTH":
        return "bg-blue-500";
      case "STARTER":
        return "bg-gray-500";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500";
      case "TRIAL":
        return "bg-yellow-500";
      case "SUSPENDED":
        return "bg-red-500";
      case "CANCELLED":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tenant Management</h1>
          <p className="text-muted-foreground">
            Manage organizations and subscriptions
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Building2 className="mr-2 h-4 w-4" />
          Add Organization
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or domain"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subscription Tier</Label>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="STARTER">Starter</SelectItem>
                  <SelectItem value="GROWTH">Growth</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Organizations ({organizations.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchOrganizations}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading organizations...</div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No organizations found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Limits</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {org.name}
                          {org.subscriptionTier === "ENTERPRISE" && (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        {org.domain && (
                          <div className="text-xs text-muted-foreground">
                            {org.domain}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className={getTierBadgeColor(org.subscriptionTier)}>
                          {org.subscriptionTier}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={getStatusBadgeColor(org.subscriptionStatus)}
                        >
                          {org.subscriptionStatus}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {org.maxUsers} users
                        </div>
                        <div className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {org.maxVehicles} vehicles
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div>{org._count.users} users</div>
                        <div>{org._count.vehicles} vehicles</div>
                        <div>{org._count.orders} orders</div>
                        <div>{org._count.quoteRequests} quotes</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(org.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(org)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSuspendOrganization(org.id)}
                          disabled={org.subscriptionStatus === "SUSPENDED"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Organization Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Add a new organization to the platform
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Acme Corporation"
              />
            </div>
            <div className="space-y-2">
              <Label>Domain (Optional)</Label>
              <Input
                value={formData.domain}
                onChange={(e) =>
                  setFormData({ ...formData, domain: e.target.value })
                }
                placeholder="e.g., acme-corp"
              />
            </div>
            <div className="space-y-2">
              <Label>Subscription Tier</Label>
              <Select
                value={formData.subscriptionTier}
                onValueChange={(value) =>
                  setFormData({ ...formData, subscriptionTier: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STARTER">Starter</SelectItem>
                  <SelectItem value="GROWTH">Growth</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subscription Status</Label>
              <Select
                value={formData.subscriptionStatus}
                onValueChange={(value) =>
                  setFormData({ ...formData, subscriptionStatus: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Users</Label>
                <Input
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxUsers: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Vehicles</Label>
                <Input
                  type="number"
                  value={formData.maxVehicles}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxVehicles: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <Input
                type="color"
                value={formData.primaryColor}
                onChange={(e) =>
                  setFormData({ ...formData, primaryColor: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateOrganization}>
              Create Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update organization settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Domain</Label>
              <Input
                value={formData.domain}
                onChange={(e) =>
                  setFormData({ ...formData, domain: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Subscription Tier</Label>
              <Select
                value={formData.subscriptionTier}
                onValueChange={(value) =>
                  setFormData({ ...formData, subscriptionTier: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STARTER">Starter</SelectItem>
                  <SelectItem value="GROWTH">Growth</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subscription Status</Label>
              <Select
                value={formData.subscriptionStatus}
                onValueChange={(value) =>
                  setFormData({ ...formData, subscriptionStatus: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Users</Label>
                <Input
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxUsers: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Vehicles</Label>
                <Input
                  type="number"
                  value={formData.maxVehicles}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxVehicles: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <Input
                type="color"
                value={formData.primaryColor}
                onChange={(e) =>
                  setFormData({ ...formData, primaryColor: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setSelectedOrg(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateOrganization}>
              Update Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
