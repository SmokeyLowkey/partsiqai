'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, CheckCircle, AlertCircle, Search, Save, Play, Loader2 } from 'lucide-react';

interface PendingVehicle {
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
}

export default function PendingVehiclesPage() {
  const { status } = useSession();
  const [vehicles, setVehicles] = useState<PendingVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<PendingVehicle | null>(null);
  const [mapping, setMapping] = useState<VehicleSearchMapping>({});
  const [testQuery, setTestQuery] = useState('oil filter');
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      loadPendingVehicles();
    }
  }, [status]);

  const loadPendingVehicles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/vehicles/pending');
      if (!response.ok) {
        throw new Error('Failed to fetch pending vehicles');
      }
      const data = await response.json();
      setVehicles(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVehicle = async (vehicle: PendingVehicle) => {
    setSelectedVehicle(vehicle);
    setError(null);
    setSuccess(null);
    setTestResults(null);

    if (vehicle.searchMapping) {
      setMapping(vehicle.searchMapping);
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
      await loadPendingVehicles();
      setSelectedVehicle(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pending Vehicle Configurations</h1>
        <p className="text-muted-foreground">
          Configure search mappings for vehicles awaiting admin review
        </p>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Pending Vehicles
            </CardTitle>
            <CardDescription>
              {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} awaiting configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && vehicles.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="text-muted-foreground">All vehicles configured!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {vehicles.map((vehicle) => (
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
                      <div>
                        <p className="font-medium text-foreground">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {vehicle.owner.name || vehicle.owner.email}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added {new Date(vehicle.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration Form */}
        <Card className="lg:col-span-2">
          {selectedVehicle ? (
            <>
              <CardHeader>
                <CardTitle>
                  Configure: {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                </CardTitle>
                <CardDescription>
                  Serial: {selectedVehicle.serialNumber} | ID: {selectedVehicle.vehicleId}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs defaultValue="pinecone" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="pinecone">Pinecone</TabsTrigger>
                    <TabsTrigger value="neo4j">Neo4j</TabsTrigger>
                    <TabsTrigger value="postgres">PostgreSQL</TabsTrigger>
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
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="neo4jModelName">Model Name</Label>
                        <Input
                          id="neo4jModelName"
                          value={mapping.neo4jModelName || ''}
                          onChange={(e) => setMapping({ ...mapping, neo4jModelName: e.target.value })}
                          placeholder="e.g., 160GLC Excavator"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="neo4jManufacturer">Manufacturer</Label>
                        <Input
                          id="neo4jManufacturer"
                          value={mapping.neo4jManufacturer || ''}
                          onChange={(e) => setMapping({ ...mapping, neo4jManufacturer: e.target.value })}
                          placeholder="e.g., John Deere"
                        />
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
                      <div className="space-y-2">
                        <Label htmlFor="neo4jNamespace">Namespace</Label>
                        <Input
                          id="neo4jNamespace"
                          value={mapping.neo4jNamespace || ''}
                          onChange={(e) => setMapping({ ...mapping, neo4jNamespace: e.target.value })}
                          placeholder="e.g., john-deere"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="neo4jTechnicalDomains">Technical Domains (comma-separated)</Label>
                        <Input
                          id="neo4jTechnicalDomains"
                          value={mapping.neo4jTechnicalDomains?.join(', ') || ''}
                          onChange={(e) => setMapping({
                            ...mapping,
                            neo4jTechnicalDomains: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })}
                          placeholder="e.g., Hydraulics, Engine, Electrical"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="neo4jCategories">Categories (comma-separated)</Label>
                        <Input
                          id="neo4jCategories"
                          value={mapping.neo4jCategories?.join(', ') || ''}
                          onChange={(e) => setMapping({
                            ...mapping,
                            neo4jCategories: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })}
                          placeholder="e.g., Filters, Belts, Hoses"
                        />
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

                  {/* Verify Button */}
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
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
              <Truck className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Select a Vehicle</h3>
              <p className="text-muted-foreground max-w-sm">
                Choose a pending vehicle from the list to configure its search mappings for Pinecone, Neo4j, and PostgreSQL.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
