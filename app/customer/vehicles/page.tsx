'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Truck,
  MapPin,
  Calendar,
  Activity,
  AlertCircle,
  Edit,
  Trash2,
  Search,
  Upload,
  FileText,
  TrendingUp,
  Clock,
  Eye,
} from 'lucide-react';

interface Vehicle {
  id: string;
  vehicleId: string;
  serialNumber: string;
  make: string;
  model: string;
  year: number;
  type: 'TRACTOR' | 'COMBINE' | 'SPRAYER' | 'HARVESTER' | 'LOADER' | 'EXCAVATOR' | 'DOZER' | 'OTHER';
  industryCategory: 'AGRICULTURE' | 'CONSTRUCTION' | 'MINING' | 'FORESTRY' | 'INDUSTRIAL' | 'OTHER';
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'RETIRED';
  currentLocation?: string;
  operatingHours: number;
  healthScore: number;
  engineModel?: string;
  maintenancePdfFileName?: string;
}

export default function VehiclesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Update Hours modal state
  const [isUpdateHoursOpen, setIsUpdateHoursOpen] = useState(false);
  const [updatingVehicle, setUpdatingVehicle] = useState<Vehicle | null>(null);
  const [newHours, setNewHours] = useState<number>(0);
  const [isUpdatingHours, setIsUpdatingHours] = useState(false);

  const [formData, setFormData] = useState<Partial<Vehicle>>({
    type: 'TRACTOR',
    industryCategory: 'AGRICULTURE',
    status: 'ACTIVE',
    operatingHours: 0,
    healthScore: 100,
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Load vehicles on mount
  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/vehicles');
      if (response.ok) {
        const data = await response.json();
        setVehicles(data.vehicles || []);
      } else {
        console.error('Failed to load vehicles');
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Open Update Hours modal
  const handleOpenUpdateHours = (vehicle: Vehicle) => {
    setUpdatingVehicle(vehicle);
    setNewHours(vehicle.operatingHours);
    setIsUpdateHoursOpen(true);
  };

  // Submit updated hours
  const handleUpdateHours = async () => {
    if (!updatingVehicle) return;

    setIsUpdatingHours(true);
    try {
      const response = await fetch(`/api/vehicles/${updatingVehicle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatingHours: newHours }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update local state
        setVehicles(vehicles.map(v =>
          v.id === updatingVehicle.id
            ? { ...v, operatingHours: newHours }
            : v
        ));
        toast({
          title: 'Hours Updated',
          description: `Operating hours updated to ${newHours.toLocaleString()}`,
        });
        setIsUpdateHoursOpen(false);
      } else {
        const errorData = await response.json();
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: errorData.error || 'Failed to update hours',
        });
      }
    } catch (error) {
      console.error('Error updating hours:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update operating hours',
      });
    } finally {
      setIsUpdatingHours(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate required fields
      if (!formData.vehicleId || !formData.serialNumber || !formData.make || !formData.model || !formData.year) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Please fill in all required fields (Vehicle ID, Serial Number, Make, Model, Year)',
        });
        return;
      }

      console.log('Submitting vehicle data:', formData);

      // Step 1: Create vehicle
      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Vehicle creation error:', errorData);
        toast({
          variant: 'destructive',
          title: 'Failed to Add Vehicle',
          description: errorData.error || 'Unknown error occurred',
        });
        return;
      }

      const data = await response.json();
      const newVehicle = data.vehicle;

      // Step 2: Upload PDF if provided
      if (pdfFile) {
        setIsUploadingPdf(true);
        try {
          const uploadFormData = new FormData();
          uploadFormData.append('file', pdfFile);

          const uploadResponse = await fetch(
            `/api/vehicles/${newVehicle.id}/upload-pdf`,
            {
              method: 'POST',
              body: uploadFormData,
            }
          );

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            // Update the vehicle with PDF info
            newVehicle.maintenancePdfFileName = uploadData.vehicle.maintenancePdfFileName;
            newVehicle.maintenancePdfUrl = uploadData.vehicle.maintenancePdfUrl;
            toast({
              title: 'Success',
              description: 'Vehicle and PDF added successfully',
            });
          } else {
            console.error('Failed to upload PDF');
            toast({
              variant: 'destructive',
              title: 'Partial Success',
              description: 'Vehicle created but PDF upload failed. You can upload it later.',
            });
          }
        } catch (uploadError) {
          console.error('Error uploading PDF:', uploadError);
          toast({
            variant: 'destructive',
            title: 'Partial Success',
            description: 'Vehicle created but PDF upload failed. You can upload it later.',
          });
        } finally {
          setIsUploadingPdf(false);
        }
      } else {
        toast({
          title: 'Success',
          description: 'Vehicle added successfully',
        });
      }

      // Step 3: Update state and close dialog
      setVehicles([...vehicles, newVehicle]);
      setIsAddDialogOpen(false);
      setFormData({
        type: 'TRACTOR',
        industryCategory: 'AGRICULTURE',
        status: 'ACTIVE',
        operatingHours: 0,
        healthScore: 100,
      });
      setPdfFile(null);
    } catch (error) {
      console.error('Error creating vehicle:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add vehicle. Please try again.',
      });
    }
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Only PDF files are allowed',
        });
        e.target.value = '';
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: 'File size must be less than 10MB',
        });
        e.target.value = '';
        return;
      }

      setPdfFile(file);
    }
  };

  const handleDownloadPdf = async (vehicleId: string) => {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/pdf-url`);
      if (response.ok) {
        const data = await response.json();
        // Open PDF in new tab
        window.open(data.url, '_blank');
      } else {
        toast({
          variant: 'destructive',
          title: 'Download Failed',
          description: 'Failed to get PDF URL',
        });
      }
    } catch (error) {
      console.error('Error getting PDF URL:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to download PDF',
      });
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      vehicleId: vehicle.vehicleId,
      serialNumber: vehicle.serialNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      type: vehicle.type,
      industryCategory: vehicle.industryCategory,
      status: vehicle.status,
      currentLocation: vehicle.currentLocation,
      operatingHours: vehicle.operatingHours,
      healthScore: vehicle.healthScore,
      engineModel: vehicle.engineModel,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingVehicle) return;

    try {
      // Validate required fields
      if (!formData.vehicleId || !formData.serialNumber || !formData.make || !formData.model || !formData.year) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Please fill in all required fields (Vehicle ID, Serial Number, Make, Model, Year)',
        });
        return;
      }

      const response = await fetch(`/api/vehicles/${editingVehicle.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Vehicle update error:', errorData);
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: errorData.error || 'Failed to update vehicle',
        });
        return;
      }

      const data = await response.json();
      let updatedVehicle = data.vehicle;

      // Upload PDF if selected
      if (pdfFile) {
        setIsUploadingPdf(true);
        try {
          const uploadFormData = new FormData();
          uploadFormData.append('file', pdfFile);

          const uploadResponse = await fetch(
            `/api/vehicles/${editingVehicle.id}/upload-pdf`,
            {
              method: 'POST',
              body: uploadFormData,
            }
          );

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            updatedVehicle = uploadData.vehicle;
            toast({
              title: 'Success',
              description: 'Vehicle and PDF updated successfully',
            });
          } else {
            console.error('PDF upload failed');
            toast({
              variant: 'destructive',
              title: 'Partial Update',
              description: 'Vehicle updated, but PDF upload failed',
            });
          }
        } catch (uploadError) {
          console.error('PDF upload error:', uploadError);
          toast({
            variant: 'destructive',
            title: 'Partial Update',
            description: 'Vehicle updated, but PDF upload failed',
          });
        } finally {
          setIsUploadingPdf(false);
        }
      } else {
        toast({
          title: 'Success',
          description: 'Vehicle updated successfully',
        });
      }

      // Update vehicle in list
      setVehicles(vehicles.map(v => v.id === editingVehicle.id ? updatedVehicle : v));

      setIsEditDialogOpen(false);
      setEditingVehicle(null);
      setPdfFile(null);
      setFormData({
        type: 'TRACTOR',
        industryCategory: 'AGRICULTURE',
        status: 'ACTIVE',
        operatingHours: 0,
        healthScore: 100,
      });
    } catch (error) {
      console.error('Error updating vehicle:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update vehicle. Please try again.',
      });
    }
  };

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.vehicleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || vehicle.status === filterStatus;
    const matchesType = filterType === 'all' || vehicle.type === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthScoreBadge = (score: number) => {
    if (score >= 90) return { label: 'Excellent', variant: 'default' as const };
    if (score >= 70) return { label: 'Good', variant: 'secondary' as const };
    return { label: 'Needs Attention', variant: 'destructive' as const };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vehicles</h1>
          <p className="text-muted-foreground">Manage your fleet and track maintenance schedules</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Vehicle</DialogTitle>
              <DialogDescription>
                Enter the vehicle information to add it to your fleet
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicleId">Vehicle ID *</Label>
                  <Input
                    id="vehicleId"
                    placeholder="VEH-001"
                    required
                    value={formData.vehicleId || ''}
                    onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number *</Label>
                  <Input
                    id="serialNumber"
                    placeholder="ABC123456"
                    required
                    value={formData.serialNumber || ''}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="make">Make *</Label>
                  <Input
                    id="make"
                    placeholder="John Deere"
                    required
                    value={formData.make || ''}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    placeholder="8320"
                    required
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year *</Label>
                  <Input
                    id="year"
                    type="number"
                    placeholder="2020"
                    required
                    value={formData.year || ''}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Vehicle Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value as Vehicle['type'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRACTOR">Tractor</SelectItem>
                      <SelectItem value="COMBINE">Combine</SelectItem>
                      <SelectItem value="SPRAYER">Sprayer</SelectItem>
                      <SelectItem value="HARVESTER">Harvester</SelectItem>
                      <SelectItem value="LOADER">Loader</SelectItem>
                      <SelectItem value="EXCAVATOR">Excavator</SelectItem>
                      <SelectItem value="DOZER">Dozer</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industryCategory">Industry *</Label>
                  <Select
                    value={formData.industryCategory}
                    onValueChange={(value) =>
                      setFormData({ ...formData, industryCategory: value as Vehicle['industryCategory'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AGRICULTURE">Agriculture</SelectItem>
                      <SelectItem value="CONSTRUCTION">Construction</SelectItem>
                      <SelectItem value="MINING">Mining</SelectItem>
                      <SelectItem value="FORESTRY">Forestry</SelectItem>
                      <SelectItem value="INDUSTRIAL">Industrial</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value as Vehicle['status'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      <SelectItem value="RETIRED">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentLocation">Current Location</Label>
                  <Input
                    id="currentLocation"
                    placeholder="Field A, Workshop..."
                    value={formData.currentLocation || ''}
                    onChange={(e) => setFormData({ ...formData, currentLocation: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="engineModel">Engine Model</Label>
                <Input
                  id="engineModel"
                  placeholder="PowerTech Plus 9.0L"
                  value={formData.engineModel || ''}
                  onChange={(e) => setFormData({ ...formData, engineModel: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="operatingHours">Operating Hours</Label>
                  <Input
                    id="operatingHours"
                    type="number"
                    placeholder="0"
                    value={formData.operatingHours || 0}
                    onChange={(e) =>
                      setFormData({ ...formData, operatingHours: parseInt(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="healthScore">Health Score (optional)</Label>
                  <Input
                    id="healthScore"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="100"
                    value={formData.healthScore || 100}
                    onChange={(e) =>
                      setFormData({ ...formData, healthScore: parseInt(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenancePdf">Maintenance Manual (PDF)</Label>
                <div className="flex gap-2">
                  <Input
                    id="maintenancePdf"
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfFileChange}
                  />
                  <Button type="button" variant="outline" size="sm" disabled>
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
                {pdfFile && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  PDF only, max 10MB
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
                  {isUploadingPdf ? 'Uploading PDF...' : 'Add Vehicle'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Vehicle Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Vehicle</DialogTitle>
              <DialogDescription>
                Update vehicle information and maintenance details
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-vehicleId">Vehicle ID *</Label>
                  <Input
                    id="edit-vehicleId"
                    placeholder="VEH-001"
                    required
                    value={formData.vehicleId || ''}
                    onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-serialNumber">Serial Number *</Label>
                  <Input
                    id="edit-serialNumber"
                    placeholder="SN123456"
                    required
                    value={formData.serialNumber || ''}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-make">Make *</Label>
                  <Input
                    id="edit-make"
                    placeholder="John Deere"
                    required
                    value={formData.make || ''}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-model">Model *</Label>
                  <Input
                    id="edit-model"
                    placeholder="8320"
                    required
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-year">Year *</Label>
                  <Input
                    id="edit-year"
                    type="number"
                    placeholder="2020"
                    required
                    value={formData.year || ''}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Vehicle Type *</Label>
                  <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRACTOR">Tractor</SelectItem>
                      <SelectItem value="COMBINE">Combine</SelectItem>
                      <SelectItem value="SPRAYER">Sprayer</SelectItem>
                      <SelectItem value="HARVESTER">Harvester</SelectItem>
                      <SelectItem value="LOADER">Loader</SelectItem>
                      <SelectItem value="EXCAVATOR">Excavator</SelectItem>
                      <SelectItem value="DOZER">Dozer</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-industryCategory">Industry Category</Label>
                  <Select value={formData.industryCategory} onValueChange={(value: any) => setFormData({ ...formData, industryCategory: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AGRICULTURE">Agriculture</SelectItem>
                      <SelectItem value="CONSTRUCTION">Construction</SelectItem>
                      <SelectItem value="MINING">Mining</SelectItem>
                      <SelectItem value="FORESTRY">Forestry</SelectItem>
                      <SelectItem value="INDUSTRIAL">Industrial</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      <SelectItem value="RETIRED">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-operatingHours">Operating Hours</Label>
                  <Input
                    id="edit-operatingHours"
                    type="number"
                    placeholder="0"
                    value={formData.operatingHours || ''}
                    onChange={(e) => setFormData({ ...formData, operatingHours: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-healthScore">Health Score (0-100)</Label>
                  <Input
                    id="edit-healthScore"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="100"
                    value={formData.healthScore || ''}
                    onChange={(e) => setFormData({ ...formData, healthScore: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-currentLocation">Current Location</Label>
                <Input
                  id="edit-currentLocation"
                  placeholder="Field A"
                  value={formData.currentLocation || ''}
                  onChange={(e) => setFormData({ ...formData, currentLocation: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-engineModel">Engine Model</Label>
                <Input
                  id="edit-engineModel"
                  placeholder="PowerTech 9.0L"
                  value={formData.engineModel || ''}
                  onChange={(e) => setFormData({ ...formData, engineModel: e.target.value })}
                />
              </div>


              <div className="space-y-2">
                <Label htmlFor="edit-maintenancePdf">Maintenance Schedule PDF</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="edit-maintenancePdf"
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfFileChange}
                  />
                  {editingVehicle?.maintenancePdfFileName && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPdf(editingVehicle.id)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      View Current PDF
                    </Button>
                  )}
                </div>
                {editingVehicle?.maintenancePdfFileName && (
                  <p className="text-xs text-muted-foreground">
                    Current file: {editingVehicle.maintenancePdfFileName}
                  </p>
                )}
                {pdfFile && (
                  <p className="text-xs text-green-600">
                    New file selected: {pdfFile.name}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingVehicle(null);
                    setPdfFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isUploadingPdf}>
                  {isUploadingPdf ? 'Uploading...' : 'Update Vehicle'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicles.length}</div>
            <p className="text-xs text-muted-foreground">
              {vehicles.filter((v) => v.status === 'ACTIVE').length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Health Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                vehicles.reduce((sum, v) => sum + v.healthScore, 0) / vehicles.length
              )}
              %
            </div>
            <p className="text-xs text-muted-foreground">Fleet average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Maintenance</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vehicles.filter((v) => v.status === 'MAINTENANCE').length}
            </div>
            <p className="text-xs text-muted-foreground">Currently servicing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operating Hours</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vehicles.reduce((sum, v) => sum + v.operatingHours, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total fleet hours</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vehicles by make, model, ID, or serial..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                <SelectItem value="RETIRED">Retired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="TRACTOR">Tractor</SelectItem>
                <SelectItem value="COMBINE">Combine</SelectItem>
                <SelectItem value="SPRAYER">Sprayer</SelectItem>
                <SelectItem value="HARVESTER">Harvester</SelectItem>
                <SelectItem value="LOADER">Loader</SelectItem>
                <SelectItem value="EXCAVATOR">Excavator</SelectItem>
                <SelectItem value="DOZER">Dozer</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {filteredVehicles.map((vehicle) => {
          const healthBadge = getHealthScoreBadge(vehicle.healthScore);
          return (
            <Card key={vehicle.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {vehicle.vehicleId} • {vehicle.serialNumber}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      vehicle.status === 'ACTIVE'
                        ? 'default'
                        : vehicle.status === 'MAINTENANCE'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {vehicle.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium">{vehicle.type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Industry</p>
                    <p className="font-medium">{vehicle.industryCategory}</p>
                  </div>
                </div>

                {vehicle.currentLocation && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{vehicle.currentLocation}</span>
                  </div>
                )}

                {vehicle.engineModel && (
                  <div className="text-sm">
                    <p className="text-muted-foreground">Engine</p>
                    <p className="font-medium">{vehicle.engineModel}</p>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Health Score</span>
                    <Badge variant={healthBadge.variant}>{healthBadge.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${vehicle.healthScore >= 90 ? 'bg-green-600' : vehicle.healthScore >= 70 ? 'bg-yellow-600' : 'bg-red-600'}`}
                        style={{ width: `${vehicle.healthScore}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold ${getHealthScoreColor(vehicle.healthScore)}`}>
                      {vehicle.healthScore}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm">
                    <p className="text-muted-foreground">Operating Hours</p>
                    <p className="font-medium">{vehicle.operatingHours.toLocaleString()}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenUpdateHours(vehicle)}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Update
                  </Button>
                </div>

                {vehicle.maintenancePdfFileName && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleDownloadPdf(vehicle.id)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Manual
                  </Button>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => router.push(`/customer/vehicles/${vehicle.id}`)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditVehicle(vehicle)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredVehicles.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No vehicles found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterStatus !== 'all' || filterType !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first vehicle'}
            </p>
            {!searchQuery && filterStatus === 'all' && filterType === 'all' && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Update Hours Dialog */}
      <Dialog open={isUpdateHoursOpen} onOpenChange={setIsUpdateHoursOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Operating Hours</DialogTitle>
            <DialogDescription>
              {updatingVehicle && (
                <>
                  Update hours for {updatingVehicle.year} {updatingVehicle.make} {updatingVehicle.model}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newHours">Current Operating Hours</Label>
              <Input
                id="newHours"
                type="number"
                min="0"
                value={newHours}
                onChange={(e) => setNewHours(parseInt(e.target.value) || 0)}
                placeholder="Enter current hours"
              />
              {updatingVehicle && newHours > updatingVehicle.operatingHours && (
                <p className="text-xs text-muted-foreground">
                  +{(newHours - updatingVehicle.operatingHours).toLocaleString()} hours since last update
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUpdateHoursOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateHours}
              disabled={isUpdatingHours}
              className="bg-green-600 hover:bg-green-700"
            >
              {isUpdatingHours ? 'Updating...' : 'Update Hours'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
