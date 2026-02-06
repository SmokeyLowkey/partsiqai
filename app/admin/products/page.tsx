"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { Package, Search, Filter, RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

type Part = {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  price: number;
  stockQuantity: number;
  minStockLevel: number;
  isActive: boolean;
  isObsolete: boolean;
  organization: { id: string; name: string };
  suppliers: Array<{ supplier: { id: string; name: string } }>;
};

export default function ProductsPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [obsoleteFilter, setObsoleteFilter] = useState<string>("false");
  const { toast } = useToast();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchParts();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, activeFilter, obsoleteFilter]);

  const fetchParts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (activeFilter !== "all") params.append("isActive", activeFilter);
      if (obsoleteFilter !== "all") params.append("isObsolete", obsoleteFilter);

      const response = await fetch(`/api/admin/products?${params}`);
      if (!response.ok) throw new Error("Failed to fetch parts");
      
      const data = await response.json();
      setParts(data.parts);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch parts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (part: Part) => {
    if (part.stockQuantity === 0) {
      return { label: "Out of Stock", color: "bg-red-500", icon: XCircle };
    } else if (part.stockQuantity <= part.minStockLevel) {
      return { label: "Low Stock", color: "bg-yellow-500", icon: AlertTriangle };
    } else {
      return { label: "In Stock", color: "bg-green-500", icon: CheckCircle };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Parts Catalog Management</h1>
          <p className="text-muted-foreground">
            Manage parts inventory across all organizations
          </p>
        </div>
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
                  placeholder="Search by part number or name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Obsolete</Label>
              <Select value={obsoleteFilter} onValueChange={setObsoleteFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Show All</SelectItem>
                  <SelectItem value="false">Active Parts</SelectItem>
                  <SelectItem value="true">Obsolete Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parts Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Parts ({parts.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchParts}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading parts...</div>
          ) : parts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No parts found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Suppliers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((part) => {
                  const stockStatus = getStockStatus(part);
                  const StockIcon = stockStatus.icon;
                  
                  return (
                    <TableRow key={part.id}>
                      <TableCell className="font-medium">{part.partNumber}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{part.name}</div>
                          {part.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-xs">
                              {part.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{part.organization.name}</TableCell>
                      <TableCell>${part.price ? Number(part.price).toFixed(2) : '0.00'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StockIcon className={`h-4 w-4 ${stockStatus.color.replace('bg-', 'text-')}`} />
                          <span>{part.stockQuantity}</span>
                          <span className="text-xs text-muted-foreground">
                            (min: {part.minStockLevel})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {part.isActive ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                          {part.isObsolete && (
                            <Badge variant="destructive">Obsolete</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {part.suppliers.length > 0 ? (
                          <div className="text-sm">
                            {part.suppliers.slice(0, 2).map((s) => s.supplier.name).join(", ")}
                            {part.suppliers.length > 2 && ` +${part.suppliers.length - 2}`}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No suppliers</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
