'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Truck,
  CheckCircle,
  AlertCircle,
  Search,
  Save,
  Play,
  Loader2,
  Settings,
  Clock,
  XCircle,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { MaintenanceScheduleReview } from '@/components/admin/MaintenanceScheduleReview';

interface Vehicle {
  id: string;
  vehicleId: string;
  make: string;
  model: string;
  year: number;
  serialNumber: string;
  searchConfigStatus: string;
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
  searchMapping?: VehicleSearchMapping;
  createdAt: string;
}

interface VehicleSearchMapping {
  id?: string;
  pineconeNamespace?: string;
  pineconeMachineModel?: string;
  pineconeManufacturer?: string;
  pineconeYear?: number;
  neo4jModelName?: string;
  neo4jManufacturer?: string;
  neo4jSerialRange?: string;
  neo4jTechnicalDomains?: string[];
  neo4jCategories?: string[];
  neo4jNamespace?: string;
  postgresCategory?: string;
  postgresSubcategory?: string;
  postgresMake?: string;
  postgresModel?: string;
  verifiedAt?: string;
  verifier?: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface StatusCounts {
  PENDING_ADMIN_REVIEW: number;
  SEARCH_READY: number;
  NEEDS_UPDATE: number;
  INACTIVE: number;
  total: number;
}

interface Neo4jSchemaData {
  manufacturers: string[];
  models: string[];
  namespaces: string[];
  technicalDomains: string[];
  categories: string[];
  nodeLabels: string[];
}

const STATUS_CONFIG = {
  PENDING_ADMIN_REVIEW: {
    label: 'Pending Review',
    color: 'border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 bg-yellow-50 dark:bg-yellow-950',
    icon: Clock,
  },
  SEARCH_READY: {
    label: 'Active',
    color: 'border-green-300 dark:border-green-700 text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-950',
    icon: CheckCircle,
  },
  NEEDS_UPDATE: {
    label: 'Needs Update',
    color: 'border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200 bg-orange-50 dark:bg-orange-950',
    icon: RefreshCw,
  },
  INACTIVE: {
    label: 'Inactive',
    color: 'border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950',
    icon: XCircle,
  },
};

export default function VehicleManagementPage() {
  const { status: sessionStatus } = useSession();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({
    PENDING_ADMIN_REVIEW: 0,
    SEARCH_READY: 0,
    NEEDS_UPDATE: 0,
    INACTIVE: 0,
    total: 0,
  });
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [mapping, setMapping] = useState<VehicleSearchMapping>({});
  const [testQuery, setTestQuery] = useState('oil filter');
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [neo4jSchema, setNeo4jSchema] = useState<Neo4jSchemaData | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      const timeoutId = setTimeout(() => {
        loadVehicles();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [sessionStatus, statusFilter, searchQuery]);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      const response = await fetch(`/api/admin/vehicles?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch vehicles');
      }
      const data = await response.json();
      setVehicles(data.vehicles);
      setCounts(data.counts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNeo4jSchema = async () => {
    setLoadingSchema(true);
    try {
      const res = await fetch('/api/integrations/neo4j/schema?discover=all');
      if (res.ok) {
        const data = await res.json();
        setNeo4jSchema(data);
      } else {
        const errorData = await res.json();
        console.error('Failed to fetch Neo4j schema:', errorData.error);
      }
    } catch (error) {
      console.error('Failed to fetch Neo4j schema:', error);
    } finally {
      setLoadingSchema(false);
    }
  };

  const fetchModelsForManufacturer = async (manufacturer: string) => {
    try {
      const res = await fetch(`/api/integrations/neo4j/schema?discover=models&manufacturer=${encodeURIComponent(manufacturer)}`);
      if (res.ok) {
        const data = await res.json();
        setNeo4jSchema(prev => prev ? { ...prev, models: data.models || [] } : null);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const handleSelectVehicle = async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setError(null);
    setSuccess(null);
    setTestResults(null);

    if (vehicle.searchMapping) {
      setMapping(vehicle.searchMapping);
      // If there's an existing manufacturer, fetch models for it
      if (vehicle.searchMapping.neo4jManufacturer && neo4jSchema) {
        fetchModelsForManufacturer(vehicle.searchMapping.neo4jManufacturer);
      }
    } else {
      setMapping({
        pineconeManufacturer: vehicle.make,
        pineconeMachineModel: `${vehicle.model}`,
        neo4jManufacturer: vehicle.make,
        neo4jModelName: `${vehicle.model}`,
        postgresMake: vehicle.make,
        postgresModel: vehicle.model,
      });
    }
  };

  const handleSaveMapping = async () => {
    if (!selectedVehicle) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/vehicles/${selectedVehicle.id}/search-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapping),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save mapping');
      }

      setSuccess('Configuration saved successfully');
      await loadVehicles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSearch = async () => {
    if (!selectedVehicle) return;

    try {
      setLoading(true);
      setError(null);
      setTestResults(null);

      await handleSaveMapping();

      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testQuery,
          vehicleContext: {
            id: selectedVehicle.id,
            make: selectedVehicle.make,
            model: selectedVehicle.model,
            year: selectedVehicle.year,
          },
        }),
      });

      const data = await response.json();
      setTestResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyVehicle = async () => {
    if (!selectedVehicle) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/vehicles/${selectedVehicle.id}/verify-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testQuery,
          testResults,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to verify vehicle');
      }

      setSuccess('Vehicle verified and activated successfully!');
      await loadVehicles();

      // Refresh the selected vehicle data
      const updatedVehicle = vehicles.find(v => v.id === selectedVehicle.id);
      if (updatedVehicle) {
        setSelectedVehicle({ ...updatedVehicle, searchConfigStatus: 'SEARCH_READY' });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedVehicle) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/vehicles/${selectedVehicle.id}/search-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mapping,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      setSuccess(`Vehicle status updated to ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label}`);
      await loadVehicles();
      setSelectedVehicle({ ...selectedVehicle, searchConfigStatus: newStatus });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const StatusIcon = selectedVehicle
    ? STATUS_CONFIG[selectedVehicle.searchConfigStatus as keyof typeof STATUS_CONFIG]?.icon || AlertCircle
    : AlertCircle;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vehicle Configuration Management</h1>
          <p className="text-muted-foreground">
            Manage search mappings for all vehicles in your organization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {counts.total} Total Vehicles
          </Badge>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'PENDING_ADMIN_REVIEW' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'PENDING_ADMIN_REVIEW' ? 'all' : 'PENDING_ADMIN_REVIEW')}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-bold text-yellow-600">{counts.PENDING_ADMIN_REVIEW}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'SEARCH_READY' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'SEARCH_READY' ? 'all' : 'SEARCH_READY')}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600">{counts.SEARCH_READY}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'NEEDS_UPDATE' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'NEEDS_UPDATE' ? 'all' : 'NEEDS_UPDATE')}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Needs Update</p>
              <p className="text-2xl font-bold text-orange-600">{counts.NEEDS_UPDATE}</p>
            </div>
            <RefreshCw className="h-8 w-8 text-orange-500" />
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'INACTIVE' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'INACTIVE' ? 'all' : 'INACTIVE')}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold text-gray-600">{counts.INACTIVE}</p>
            </div>
            <XCircle className="h-8 w-8 text-gray-500" />
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-800 dark:text-green-200">{success}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Vehicle List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              All Vehicles
            </CardTitle>
            <CardDescription>
              {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
              {statusFilter !== 'all' && ` (filtered)`}
            </CardDescription>
            {/* Search Input */}
            <div className="pt-2">
              <Input
                placeholder="Search vehicles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading && vehicles.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No vehicles found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {vehicles.map((vehicle) => {
                  const statusConfig = STATUS_CONFIG[vehicle.searchConfigStatus as keyof typeof STATUS_CONFIG];
                  const StatusBadgeIcon = statusConfig?.icon || AlertCircle;
                  return (
                    <div
                      key={vehicle.id}
                      onClick={() => handleSelectVehicle(vehicle)}
                      className={`p-3 border border-border rounded-lg cursor-pointer transition-colors ${
                        selectedVehicle?.id === vehicle.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {vehicle.owner.name || vehicle.owner.email}
                          </p>
                        </div>
                        <Badge variant="outline" className={`text-xs ml-2 shrink-0 ${statusConfig?.color || ''}`}>
                          <StatusBadgeIcon className="h-3 w-3 mr-1" />
                          {statusConfig?.label || vehicle.searchConfigStatus}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        SN: {vehicle.serialNumber}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration Form */}
        <Card className="lg:col-span-2">
          {selectedVehicle ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                    </CardTitle>
                    <CardDescription>
                      Serial: {selectedVehicle.serialNumber} | ID: {selectedVehicle.vehicleId}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={STATUS_CONFIG[selectedVehicle.searchConfigStatus as keyof typeof STATUS_CONFIG]?.color || ''}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {STATUS_CONFIG[selectedVehicle.searchConfigStatus as keyof typeof STATUS_CONFIG]?.label || selectedVehicle.searchConfigStatus}
                  </Badge>
                </div>
                {/* Verification Info */}
                {selectedVehicle.searchMapping?.verifiedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Verified on {new Date(selectedVehicle.searchMapping.verifiedAt).toLocaleDateString()} by {selectedVehicle.searchMapping.verifier?.name || selectedVehicle.searchMapping.verifier?.email}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status Change */}
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <Label className="shrink-0">Status:</Label>
                  <Select
                    value={selectedVehicle.searchConfigStatus}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING_ADMIN_REVIEW">Pending Review</SelectItem>
                      <SelectItem value="SEARCH_READY">Active</SelectItem>
                      <SelectItem value="NEEDS_UPDATE">Needs Update</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Tabs defaultValue="pinecone" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="pinecone">Pinecone</TabsTrigger>
                    <TabsTrigger value="neo4j">Neo4j</TabsTrigger>
                    <TabsTrigger value="postgres">PostgreSQL</TabsTrigger>
                    <TabsTrigger value="maintenance" className="flex items-center gap-1">
                      <Wrench className="h-3 w-3" />
                      Maintenance
                    </TabsTrigger>
                  </TabsList>

                  {/* Pinecone Tab */}
                  <TabsContent value="pinecone" className="space-y-4 mt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="pineconeNamespace">Namespace</Label>
                        <Input
                          id="pineconeNamespace"
                          value={mapping.pineconeNamespace || ''}
                          onChange={(e) => setMapping({ ...mapping, pineconeNamespace: e.target.value })}
                          placeholder="e.g., john-deere-excavator"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pineconeMachineModel">Machine Model</Label>
                        <Input
                          id="pineconeMachineModel"
                          value={mapping.pineconeMachineModel || ''}
                          onChange={(e) => setMapping({ ...mapping, pineconeMachineModel: e.target.value })}
                          placeholder="e.g., 160GLC Excavator"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pineconeManufacturer">Manufacturer</Label>
                        <Input
                          id="pineconeManufacturer"
                          value={mapping.pineconeManufacturer || ''}
                          onChange={(e) => setMapping({ ...mapping, pineconeManufacturer: e.target.value })}
                          placeholder="e.g., John Deere"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pineconeYear">Year (optional)</Label>
                        <Input
                          id="pineconeYear"
                          type="number"
                          value={mapping.pineconeYear || ''}
                          onChange={(e) => setMapping({ ...mapping, pineconeYear: e.target.value ? parseInt(e.target.value) : undefined })}
                          placeholder={selectedVehicle.year.toString()}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Neo4j Tab */}
                  <TabsContent value="neo4j" className="space-y-4 mt-4">
                    {/* Load Schema Button */}
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="text-sm">
                        {neo4jSchema ? (
                          <span className="text-green-600 dark:text-green-400">
                            <CheckCircle className="h-4 w-4 inline mr-1" />
                            Schema loaded ({neo4jSchema.manufacturers?.length || 0} manufacturers)
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Load schema to see available values from Neo4j
                          </span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchNeo4jSchema}
                        disabled={loadingSchema}
                      >
                        {loadingSchema ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {neo4jSchema ? 'Refresh Schema' : 'Load Schema'}
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Manufacturer Dropdown/Input */}
                      <div className="space-y-2">
                        <Label htmlFor="neo4jManufacturer">Manufacturer</Label>
                        {neo4jSchema && neo4jSchema.manufacturers?.length > 0 ? (
                          <Select
                            value={mapping.neo4jManufacturer || ''}
                            onValueChange={(value) => {
                              setMapping({ ...mapping, neo4jManufacturer: value, neo4jModelName: '' });
                              fetchModelsForManufacturer(value);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select manufacturer" />
                            </SelectTrigger>
                            <SelectContent>
                              {neo4jSchema.manufacturers.map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="neo4jManufacturer"
                            value={mapping.neo4jManufacturer || ''}
                            onChange={(e) => setMapping({ ...mapping, neo4jManufacturer: e.target.value })}
                            placeholder={neo4jSchema ? "No manufacturers found" : "Load schema for options"}
                          />
                        )}
                      </div>

                      {/* Model Dropdown/Input */}
                      <div className="space-y-2">
                        <Label htmlFor="neo4jModelName">Model Name</Label>
                        {neo4jSchema && neo4jSchema.models?.length > 0 ? (
                          <Select
                            value={mapping.neo4jModelName || ''}
                            onValueChange={(value) => setMapping({ ...mapping, neo4jModelName: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {neo4jSchema.models.map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="neo4jModelName"
                            value={mapping.neo4jModelName || ''}
                            onChange={(e) => setMapping({ ...mapping, neo4jModelName: e.target.value })}
                            placeholder={mapping.neo4jManufacturer ? "Select manufacturer first" : "e.g., 160GLC Excavator"}
                          />
                        )}
                      </div>

                      {/* Namespace Dropdown/Input */}
                      <div className="space-y-2">
                        <Label htmlFor="neo4jNamespace">Namespace</Label>
                        {neo4jSchema && neo4jSchema.namespaces?.length > 0 ? (
                          <Select
                            value={mapping.neo4jNamespace || '__none__'}
                            onValueChange={(value) => setMapping({ ...mapping, neo4jNamespace: value === '__none__' ? '' : value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select namespace (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None (no filter)</SelectItem>
                              {neo4jSchema.namespaces.map((n) => (
                                <SelectItem key={n} value={n}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="neo4jNamespace"
                            value={mapping.neo4jNamespace || ''}
                            onChange={(e) => setMapping({ ...mapping, neo4jNamespace: e.target.value })}
                            placeholder="e.g., john-deere"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="neo4jSerialRange">Serial Number Range</Label>
                        <Input
                          id="neo4jSerialRange"
                          value={mapping.neo4jSerialRange || ''}
                          onChange={(e) => setMapping({ ...mapping, neo4jSerialRange: e.target.value })}
                          placeholder="e.g., 1FF160GXCMG000001-999999"
                        />
                      </div>

                      {/* Technical Domains Multi-Select */}
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="neo4jTechnicalDomains">Technical Domains</Label>
                        {neo4jSchema && neo4jSchema.technicalDomains?.length > 0 ? (
                          <div className="flex flex-wrap gap-2 p-2 border border-input rounded-md min-h-[40px]">
                            {neo4jSchema.technicalDomains.map((domain) => {
                              const isSelected = mapping.neo4jTechnicalDomains?.includes(domain);
                              return (
                                <Badge
                                  key={domain}
                                  variant={isSelected ? "default" : "outline"}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    const current = mapping.neo4jTechnicalDomains || [];
                                    if (isSelected) {
                                      setMapping({
                                        ...mapping,
                                        neo4jTechnicalDomains: current.filter(d => d !== domain),
                                      });
                                    } else {
                                      setMapping({
                                        ...mapping,
                                        neo4jTechnicalDomains: [...current, domain],
                                      });
                                    }
                                  }}
                                >
                                  {domain}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <Input
                            id="neo4jTechnicalDomains"
                            value={mapping.neo4jTechnicalDomains?.join(', ') || ''}
                            onChange={(e) => setMapping({
                              ...mapping,
                              neo4jTechnicalDomains: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })}
                            placeholder="e.g., Hydraulics, Engine, Electrical"
                          />
                        )}
                        {mapping.neo4jTechnicalDomains && mapping.neo4jTechnicalDomains.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Selected: {mapping.neo4jTechnicalDomains.join(', ')}
                          </p>
                        )}
                      </div>

                      {/* Categories Multi-Select */}
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="neo4jCategories">Categories</Label>
                          {neo4jSchema && neo4jSchema.categories?.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => {
                                const allSelected = mapping.neo4jCategories?.length === neo4jSchema.categories.length;
                                setMapping({
                                  ...mapping,
                                  neo4jCategories: allSelected ? [] : [...neo4jSchema.categories],
                                });
                              }}
                            >
                              {mapping.neo4jCategories?.length === neo4jSchema.categories?.length
                                ? 'Deselect All'
                                : 'Select All'}
                            </Button>
                          )}
                        </div>
                        {neo4jSchema && neo4jSchema.categories?.length > 0 ? (
                          <div className="flex flex-wrap gap-2 p-2 border border-input rounded-md min-h-[40px] max-h-[120px] overflow-y-auto">
                            {neo4jSchema.categories.map((category) => {
                              const isSelected = mapping.neo4jCategories?.includes(category);
                              return (
                                <Badge
                                  key={category}
                                  variant={isSelected ? "default" : "outline"}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    const current = mapping.neo4jCategories || [];
                                    if (isSelected) {
                                      setMapping({
                                        ...mapping,
                                        neo4jCategories: current.filter(c => c !== category),
                                      });
                                    } else {
                                      setMapping({
                                        ...mapping,
                                        neo4jCategories: [...current, category],
                                      });
                                    }
                                  }}
                                >
                                  {category}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <Input
                            id="neo4jCategories"
                            value={mapping.neo4jCategories?.join(', ') || ''}
                            onChange={(e) => setMapping({
                              ...mapping,
                              neo4jCategories: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })}
                            placeholder="e.g., Filters, Belts, Hoses"
                          />
                        )}
                        {mapping.neo4jCategories && mapping.neo4jCategories.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Selected: {mapping.neo4jCategories.length} of {neo4jSchema?.categories?.length || 0}
                          </p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* PostgreSQL Tab */}
                  <TabsContent value="postgres" className="space-y-4 mt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="postgresCategory">Category</Label>
                        <Input
                          id="postgresCategory"
                          value={mapping.postgresCategory || ''}
                          onChange={(e) => setMapping({ ...mapping, postgresCategory: e.target.value })}
                          placeholder="e.g., Heavy Equipment Parts"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postgresSubcategory">Subcategory</Label>
                        <Input
                          id="postgresSubcategory"
                          value={mapping.postgresSubcategory || ''}
                          onChange={(e) => setMapping({ ...mapping, postgresSubcategory: e.target.value })}
                          placeholder="e.g., Excavator Components"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postgresMake">Make</Label>
                        <Input
                          id="postgresMake"
                          value={mapping.postgresMake || ''}
                          onChange={(e) => setMapping({ ...mapping, postgresMake: e.target.value })}
                          placeholder="e.g., John Deere"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postgresModel">Model</Label>
                        <Input
                          id="postgresModel"
                          value={mapping.postgresModel || ''}
                          onChange={(e) => setMapping({ ...mapping, postgresModel: e.target.value })}
                          placeholder="e.g., 160GLC"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Maintenance Schedule Tab */}
                  <TabsContent value="maintenance" className="mt-4">
                    <MaintenanceScheduleReview
                      vehicleId={selectedVehicle.id}
                      vehicleName={`${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`}
                    />
                  </TabsContent>
                </Tabs>

                {/* Action Buttons */}
                <div className="flex flex-col gap-4 pt-4 border-t border-border">
                  <Button onClick={handleSaveMapping} disabled={saving} className="w-full">
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Configuration
                  </Button>

                  {/* Test Search */}
                  <div className="space-y-3">
                    <Label>Test Search</Label>
                    <div className="flex gap-2">
                      <Input
                        value={testQuery}
                        onChange={(e) => setTestQuery(e.target.value)}
                        placeholder="e.g., oil filter"
                        className="flex-1"
                      />
                      <Button onClick={handleTestSearch} disabled={loading} variant="outline">
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {testResults && (
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        <p className="font-medium text-foreground mb-1">Test Results:</p>
                        <p className="text-muted-foreground">
                          {testResults.assistantMessage?.content?.substring(0, 200) || 'No results'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Verify Button - Only show for non-SEARCH_READY vehicles */}
                  {selectedVehicle.searchConfigStatus !== 'SEARCH_READY' && (
                    <Button
                      onClick={handleVerifyVehicle}
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Verify & Activate Vehicle
                    </Button>
                  )}
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-6">
              <Settings className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Select a Vehicle</h3>
              <p className="text-muted-foreground max-w-sm">
                Choose a vehicle from the list to view or edit its search configuration for Pinecone, Neo4j, and PostgreSQL.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
