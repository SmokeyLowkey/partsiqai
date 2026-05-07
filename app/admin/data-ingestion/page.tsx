"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { trackEvent, AnalyticsEvents } from "@/lib/analytics";
import {
  Upload,
  FileUp,
  RefreshCw,
  Eye,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Database,
  Truck,
} from "lucide-react";

type BackendCounts = {
  PENDING: number;
  IN_PROGRESS: number;
  OK: number;
  FAILED: number;
  REJECTED: number;
};

type IngestionJob = {
  id: string;
  organizationId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  totalRecords: number;
  processedRecords: number;
  // Prepare-phase outcome for the whole file:
  //   successRecords = unique valid records that entered the outbox pipeline
  //   failedRecords  = records rejected by Zod validation in prepare
  // Per-backend ingestion success/failure lives in the *SuccessRecords /
  // *FailedRecords columns below.
  successRecords: number;
  failedRecords: number;
  postgresSuccessRecords?: number;
  postgresFailedRecords?: number;
  pineconeSuccessRecords?: number;
  pineconeFailedRecords?: number;
  neo4jSuccessRecords?: number;
  neo4jFailedRecords?: number;
  totalChunks?: number;
  preparedChunks?: number;
  postgresStatus: string;
  pineconeStatus: string;
  neo4jStatus: string;
  errors: any[] | null;
  warnings: any[] | null;
  options: any;
  createdAt: string;
  organization: { name: string };
  user: { name: string | null; email: string };
  // Only present on the detail endpoint response. Holds chunk counts per
  // backend once the prepare phase has fanned out.
  backendBreakdown?: {
    POSTGRES: BackendCounts;
    PINECONE: BackendCounts;
    NEO4J: BackendCounts;
  };
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<any> }> = {
  PENDING: { label: "Pending", variant: "outline", icon: Clock },
  PREPARING: { label: "Preparing", variant: "secondary", icon: Loader2 },
  READY: { label: "Ready", variant: "secondary", icon: Loader2 },
  VALIDATING: { label: "Validating", variant: "secondary", icon: Loader2 },
  PROCESSING: { label: "Processing", variant: "secondary", icon: Loader2 },
  COMPLETED: { label: "Completed", variant: "default", icon: CheckCircle2 },
  COMPLETED_WITH_ERRORS: { label: "Partial", variant: "outline", icon: AlertTriangle },
  FAILED: { label: "Failed", variant: "destructive", icon: XCircle },
};

const PHASE_CONFIG: Record<string, { color: string }> = {
  PENDING: { color: "text-muted-foreground" },
  IN_PROGRESS: { color: "text-blue-500" },
  COMPLETED: { color: "text-green-500" },
  FAILED: { color: "text-red-500" },
  SKIPPED: { color: "text-muted-foreground" },
};

type OrgVehicle = {
  id: string;
  vehicleId: string;
  make: string;
  model: string;
  year: number;
  type: string;
};

export default function DataIngestionPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMasterAdmin = session?.user?.role === "MASTER_ADMIN";

  // Vehicle state
  const [vehicles, setVehicles] = useState<OrgVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [targetOrgId, setTargetOrgId] = useState("");
  const [options, setOptions] = useState({
    dryRun: false,
    skipPostgres: false,
    skipPinecone: false,
    skipNeo4j: false,
    defaultManufacturer: "",
    defaultMachineModel: "",
    defaultNamespace: "",
    defaultTechnicalDomain: "",
    defaultSerialNumberRange: "",
  });

  // Database configuration status
  const [dbStatus, setDbStatus] = useState<{
    pinecone: { configured: boolean; loading: boolean };
    neo4j: { configured: boolean; loading: boolean };
  }>({
    pinecone: { configured: false, loading: true },
    neo4j: { configured: false, loading: true },
  });

  // Jobs state
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<IngestionJob | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ingestion?limit=50");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();
      setJobs(data.jobs);
    } catch {
      // Silently fail on polling
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch organization vehicles on mount
  useEffect(() => {
    async function loadVehicles() {
      try {
        const res = await fetch("/api/vehicles");
        if (res.ok) {
          const data = await res.json();
          setVehicles(data.vehicles ?? data ?? []);
        }
      } catch {
        // silently fail
      } finally {
        setVehiclesLoading(false);
      }
    }
    loadVehicles();
  }, []);

  // Auto-populate defaults when a vehicle is selected
  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (vehicle) {
      const namespace = `${vehicle.make}-${vehicle.model}`.toLowerCase().replace(/\s+/g, "-");
      setOptions((prev) => ({
        ...prev,
        defaultManufacturer: vehicle.make,
        defaultMachineModel: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        defaultNamespace: namespace,
      }));
    }
  };

  // Check database configuration status on mount
  useEffect(() => {
    async function checkIntegration(type: string) {
      try {
        const res = await fetch(`/api/integrations/${type}`);
        if (!res.ok) return false;
        const data = await res.json();
        return data.hasCredentials === true;
      } catch {
        return false;
      }
    }

    Promise.all([checkIntegration("pinecone"), checkIntegration("neo4j")]).then(
      ([pinecone, neo4j]) => {
        setDbStatus({
          pinecone: { configured: pinecone, loading: false },
          neo4j: { configured: neo4j, loading: false },
        });
      }
    );
  }, []);

  useEffect(() => {
    fetchJobs();
    // Poll for updates every 5 seconds if any jobs are processing
    const interval = setInterval(() => {
      const hasActiveJobs = jobs.some((j) =>
        ["PENDING", "VALIDATING", "PROCESSING"].includes(j.status)
      );
      if (hasActiveJobs) fetchJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs, jobs]);

  /**
   * Pull the model + serial-range out of common scraper filename patterns
   * like `enriched_160GLC Excavator (PIN_ 1FF160GX_ _F055671-058866).csv`.
   * Only returns strings that look reasonable; the user can overwrite.
   */
  const parseFilenameHints = (fileName: string): { machineModel?: string; serialNumberRange?: string } => {
    let base = fileName.replace(/\.(csv|json)$/i, "");
    // Common scraper prefixes
    base = base.replace(/^(enriched|scraped|parts|catalog)[_-]/i, "");

    // Serial range lives inside a (PIN_ ...) / (PIN: ...) / (S/N ...) block
    const pinMatch = base.match(/\((?:PIN|S\/N|SN)[_:\s-]+([^)]+)\)/i);
    const serialNumberRange = pinMatch ? pinMatch[1].trim().replace(/\s+/g, " ") : undefined;

    // Everything before the PIN block (if any) is the model.
    const modelPart = base.replace(/\s*\((?:PIN|S\/N|SN)[^)]*\)\s*/i, "").trim();
    const machineModel = modelPart || undefined;

    return { machineModel, serialNumberRange };
  };

  /**
   * Read just enough of a JSON file to recover the top-level `metadata`
   * object, so we can pre-fill form fields without slurping the whole file
   * (which can be 100s of MB). Walks braces respecting string escapes.
   */
  const extractJsonMetadata = async (file: File): Promise<Record<string, unknown> | null> => {
    try {
      const slice = await file.slice(0, 64 * 1024).text();
      const keyIdx = slice.search(/"metadata"\s*:\s*\{/);
      if (keyIdx === -1) return null;
      const braceStart = slice.indexOf("{", keyIdx + "\"metadata\"".length);
      if (braceStart === -1) return null;
      let depth = 1;
      let i = braceStart + 1;
      let inString = false;
      let escaped = false;
      while (i < slice.length && depth > 0) {
        const ch = slice[i];
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === "\"") {
          inString = !inString;
        } else if (!inString) {
          if (ch === "{") depth++;
          else if (ch === "}") depth--;
        }
        i++;
      }
      if (depth !== 0) return null;
      return JSON.parse(slice.slice(braceStart, i));
    } catch {
      return null;
    }
  };

  const slugifyNamespace = (...parts: Array<string | undefined>): string => {
    return parts
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".csv") && !ext.endsWith(".json")) {
      toast({ title: "Invalid file type", description: "Only CSV and JSON files are supported", variant: "destructive" });
      return;
    }

    setSelectedFile(file);

    // Auto-fill order: vehicle-sourced defaults already in state win; only
    // backfill empty fields. File-derived hints lose to whatever the user
    // or vehicle selection already chose.
    const filenameHints = parseFilenameHints(file.name);
    const metadataHints = ext.endsWith(".json") ? await extractJsonMetadata(file) : null;

    setOptions((prev) => {
      const next = { ...prev };

      const mergeField = (key: keyof typeof next, candidate?: unknown) => {
        if (typeof candidate === "string" && candidate.trim() && !next[key]) {
          (next[key] as string) = candidate.trim();
        }
      };

      // JSON metadata is authoritative for JSON uploads — parses explicit values
      if (metadataHints) {
        mergeField("defaultManufacturer", metadataHints.manufacturer);
        mergeField("defaultMachineModel", metadataHints.machineModel);
        mergeField("defaultNamespace", metadataHints.namespace);
        mergeField("defaultTechnicalDomain", metadataHints.technicalDomain);
        mergeField("defaultSerialNumberRange", metadataHints.serialNumberRange);
      }

      // Filename hints are best-effort — only fill fields still empty
      mergeField("defaultMachineModel", filenameHints.machineModel);
      mergeField("defaultSerialNumberRange", filenameHints.serialNumberRange);

      // If namespace is still empty but we have manufacturer + model, derive one
      if (!next.defaultNamespace && next.defaultManufacturer && next.defaultMachineModel) {
        next.defaultNamespace = slugifyNamespace(next.defaultManufacturer, next.defaultMachineModel);
      }

      return next;
    });
  };

  /**
   * Required-field gate for the upload button. Returns the list of labels
   * still to fill so we can show them in a toast + inline under the button.
   * technicalDomain stays optional — not every catalog has one.
   */
  const getMissingFields = (): string[] => {
    const missing: string[] = [];
    if (!selectedFile) missing.push("File");
    if (!isMasterAdmin && !selectedVehicleId) missing.push("Vehicle");
    if (!options.defaultManufacturer.trim()) missing.push("Default Manufacturer");
    if (!options.defaultMachineModel.trim()) missing.push("Default Machine Model");
    if (!options.defaultNamespace.trim()) missing.push("Default Namespace");
    if (!options.defaultSerialNumberRange.trim()) missing.push("Default Serial Number Range");
    // Can't skip both backends — nothing would be ingested
    if (options.skipPinecone && options.skipNeo4j && (!isMasterAdmin || options.skipPostgres)) {
      missing.push("At least one storage backend (Pinecone/Neo4j/Postgres)");
    }
    return missing;
  };

  const missingFields = getMissingFields();

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Defense-in-depth: the button should already be disabled, but if a
    // keyboard-navigation edge case lets a click through, surface the list
    // of missing fields as a toast instead of sending a half-filled request.
    const missing = getMissingFields();
    if (missing.length > 0) {
      toast({
        title: "Missing required fields",
        description: missing.join(", "),
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (isMasterAdmin && targetOrgId) {
        formData.append("organizationId", targetOrgId);
      }

      // Build options object, only including non-empty string values
      const cleanOptions: any = {
        dryRun: options.dryRun,
        skipPostgres: options.skipPostgres,
        skipPinecone: options.skipPinecone,
        skipNeo4j: options.skipNeo4j,
      };
      if (selectedVehicleId) cleanOptions.vehicleId = selectedVehicleId;
      if (options.defaultManufacturer) cleanOptions.defaultManufacturer = options.defaultManufacturer;
      if (options.defaultMachineModel) cleanOptions.defaultMachineModel = options.defaultMachineModel;
      if (options.defaultNamespace) cleanOptions.defaultNamespace = options.defaultNamespace;
      if (options.defaultTechnicalDomain) cleanOptions.defaultTechnicalDomain = options.defaultTechnicalDomain;
      if (options.defaultSerialNumberRange) cleanOptions.defaultSerialNumberRange = options.defaultSerialNumberRange;

      formData.append("options", JSON.stringify(cleanOptions));

      const res = await fetch("/api/admin/ingestion/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      // Activation funnel: ingestion upload is step 2 of the trial activation
      // path (signup → vehicle → ingestion → search → quote). Track here so
      // we can measure where trial users drop off.
      trackEvent(AnalyticsEvents.INGESTION_UPLOADED, {
        ingestionJobId: data.ingestionJobId,
        fileType: selectedFile.name.toLowerCase().endsWith(".csv") ? "csv" : "json",
        fileSizeBytes: selectedFile.size,
        vehicleId: selectedVehicleId || null,
      });

      toast({ title: "Upload successful", description: `Job ${data.ingestionJobId} created` });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchJobs();
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/ingestion/${jobId}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Retry queued", description: `New job ${data.ingestionJobId} created` });
      fetchJobs();
    } catch (error: any) {
      toast({ title: "Retry failed", description: error.message, variant: "destructive" });
    }
  };

  const handleViewDetails = async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/ingestion/${jobId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedJob(data);
      setDetailDialogOpen(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Data Ingestion</h2>
        <p className="text-muted-foreground">
          Upload parts catalog data to populate PostgreSQL, Pinecone, and Neo4j databases.
        </p>
      </div>

      {/* Database Configuration Status */}
      {!dbStatus.pinecone.loading && !dbStatus.neo4j.loading && (
        <Card className={
          !dbStatus.pinecone.configured || !dbStatus.neo4j.configured
            ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20"
            : "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20"
        }>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Database className={`h-5 w-5 mt-0.5 ${
                !dbStatus.pinecone.configured || !dbStatus.neo4j.configured
                  ? "text-amber-500"
                  : "text-green-500"
              }`} />
              <div className="space-y-2 flex-1">
                <h4 className="font-medium text-sm">
                  {dbStatus.pinecone.configured && dbStatus.neo4j.configured
                    ? "All databases configured"
                    : "Database configuration required"}
                </h4>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    {dbStatus.pinecone.configured ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span>Pinecone (Vector Search)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {dbStatus.neo4j.configured ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span>Neo4j (Graph Database)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>PostgreSQL (always available)</span>
                  </div>
                </div>
                {(!dbStatus.pinecone.configured || !dbStatus.neo4j.configured) && (
                  <p className="text-xs text-muted-foreground">
                    {!dbStatus.pinecone.configured && !dbStatus.neo4j.configured
                      ? "Pinecone and Neo4j are not configured. Ingestion will only populate PostgreSQL unless you configure these integrations in Settings."
                      : !dbStatus.pinecone.configured
                        ? "Pinecone is not configured. Vector search will be unavailable for ingested parts unless you configure it in Settings."
                        : "Neo4j is not configured. Graph relationships will be unavailable for ingested parts unless you configure it in Settings."}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Parts Data
          </CardTitle>
          <CardDescription>
            Upload a CSV or JSON file containing parts catalog data. CSV columns: part_key, part_title, part_number, part_quantity, part_remarks, source_url, breadcrumb, diagram_title.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="file">File (CSV or JSON)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="file"
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileChange}
                className="max-w-md"
              />
              {selectedFile && (
                <span className="text-sm text-muted-foreground">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </span>
              )}
            </div>
          </div>

          {/* Target Org (MASTER_ADMIN only) */}
          {isMasterAdmin && (
            <div className="space-y-2">
              <Label htmlFor="orgId">Target Organization ID (leave empty for your org)</Label>
              <Input
                id="orgId"
                placeholder="Organization ID"
                value={targetOrgId}
                onChange={(e) => setTargetOrgId(e.target.value)}
                className="max-w-md"
              />
            </div>
          )}

          {/* Vehicle Selector */}
          {!isMasterAdmin && (
            <div className="space-y-2">
              <Label>Vehicle <span className="text-destructive">*</span></Label>
              {vehiclesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading vehicles...
                </div>
              ) : vehicles.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                  <Truck className="h-4 w-4" />
                  No vehicles found. <a href="/admin/vehicles" className="underline">Add a vehicle</a> before uploading parts data.
                </div>
              ) : (
                <Select value={selectedVehicleId} onValueChange={handleVehicleSelect}>
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Select a vehicle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.year} {v.make} {v.model} ({v.vehicleId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Parts data will be associated with this vehicle for search.
              </p>
            </div>
          )}

          {/* Default Values for CSV. Empty required fields get a red border
              after a file is selected so the user can spot what still needs
              attention without reading the summary below. */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">
                Default Manufacturer <span className="text-destructive">*</span>
              </Label>
              <Input
                id="manufacturer"
                placeholder="e.g., John Deere"
                value={options.defaultManufacturer}
                onChange={(e) => setOptions({ ...options, defaultManufacturer: e.target.value })}
                className={selectedFile && !options.defaultManufacturer.trim() ? "border-destructive" : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="machineModel">
                Default Machine Model <span className="text-destructive">*</span>
              </Label>
              <Input
                id="machineModel"
                placeholder="e.g., 160GLC Excavator"
                value={options.defaultMachineModel}
                onChange={(e) => setOptions({ ...options, defaultMachineModel: e.target.value })}
                className={selectedFile && !options.defaultMachineModel.trim() ? "border-destructive" : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="namespace">
                Default Namespace <span className="text-destructive">*</span>
              </Label>
              <Input
                id="namespace"
                placeholder="e.g., john-deere-160glc"
                value={options.defaultNamespace}
                onChange={(e) => setOptions({ ...options, defaultNamespace: e.target.value })}
                className={selectedFile && !options.defaultNamespace.trim() ? "border-destructive" : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Used as the Pinecone namespace for vehicle-scoped search. Kebab-case recommended.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="technicalDomain">Default Technical Domain</Label>
              <Input
                id="technicalDomain"
                placeholder="e.g., Hydraulics"
                value={options.defaultTechnicalDomain}
                onChange={(e) => setOptions({ ...options, defaultTechnicalDomain: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Optional.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serialRange">
                Default Serial Number Range <span className="text-destructive">*</span>
              </Label>
              <Input
                id="serialRange"
                placeholder="e.g., 1FF160GX..."
                value={options.defaultSerialNumberRange}
                onChange={(e) => setOptions({ ...options, defaultSerialNumberRange: e.target.value })}
                className={selectedFile && !options.defaultSerialNumberRange.trim() ? "border-destructive" : undefined}
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dryRun"
                checked={options.dryRun}
                onCheckedChange={(checked) => setOptions({ ...options, dryRun: !!checked })}
              />
              <Label htmlFor="dryRun" className="text-sm">Dry Run (validate only)</Label>
            </div>
            {isMasterAdmin && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skipPostgres"
                  checked={options.skipPostgres}
                  onCheckedChange={(checked) => setOptions({ ...options, skipPostgres: !!checked })}
                />
                <Label htmlFor="skipPostgres" className="text-sm">Skip PostgreSQL</Label>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="skipPinecone"
                checked={options.skipPinecone}
                onCheckedChange={(checked) => setOptions({ ...options, skipPinecone: !!checked })}
              />
              <Label htmlFor="skipPinecone" className="text-sm">Skip Pinecone</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="skipNeo4j"
                checked={options.skipNeo4j}
                onCheckedChange={(checked) => setOptions({ ...options, skipNeo4j: !!checked })}
              />
              <Label htmlFor="skipNeo4j" className="text-sm">Skip Neo4j</Label>
            </div>
          </div>

          {/* Missing-fields summary. Rendered only after a file is selected
              so the user sees what's blocking them without being nagged
              before they've started. Matches the Upload button disabled logic. */}
          {selectedFile && missingFields.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">Fill the following before uploading:</p>
                <ul className="list-inside list-disc">
                  {missingFields.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={uploading || missingFields.length > 0}
            className="w-full sm:w-auto"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <FileUp className="mr-2 h-4 w-4" />
                Upload & Start Ingestion
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Job History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ingestion History</CardTitle>
              <CardDescription>Past and current ingestion jobs</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchJobs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No ingestion jobs yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  {isMasterAdmin && <TableHead>Organization</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Phases</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const statusCfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.PENDING;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{job.fileName}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({formatFileSize(job.fileSize)})
                          </span>
                        </div>
                      </TableCell>
                      {isMasterAdmin && (
                        <TableCell className="text-sm">{job.organization.name}</TableCell>
                      )}
                      <TableCell>
                        <Badge variant={statusCfg.variant} className="gap-1">
                          <StatusIcon className={`h-3 w-3 ${job.status === "PROCESSING" || job.status === "VALIDATING" ? "animate-spin" : ""}`} />
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {job.totalRecords > 0 ? (
                          <span>
                            {job.successRecords}/{job.totalRecords}
                            {job.failedRecords > 0 && (
                              <span className="text-red-500 ml-1">({job.failedRecords} failed)</span>
                            )}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5 text-xs">
                          <span className={PHASE_CONFIG[job.postgresStatus]?.color} title={`PostgreSQL: ${job.postgresStatus}`}>PG</span>
                          <span className={PHASE_CONFIG[job.pineconeStatus]?.color} title={`Pinecone: ${job.pineconeStatus}`}>PC</span>
                          <span className={PHASE_CONFIG[job.neo4jStatus]?.color} title={`Neo4j: ${job.neo4jStatus}`}>N4</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(job.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetails(job.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(job.status === "FAILED" || job.status === "COMPLETED_WITH_ERRORS") && (
                            <Button variant="ghost" size="sm" onClick={() => handleRetry(job.id)}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ingestion Job Details</DialogTitle>
            <DialogDescription>{selectedJob?.fileName}</DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <Badge variant={STATUS_CONFIG[selectedJob.status]?.variant || "outline"}>
                    {selectedJob.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">File:</span>{" "}
                  {selectedJob.fileName} ({formatFileSize(selectedJob.fileSize)})
                </div>
                <div>
                  <span className="text-muted-foreground">Total Records:</span> {selectedJob.totalRecords}
                  {typeof selectedJob.successRecords === 'number' && selectedJob.successRecords !== selectedJob.totalRecords ? (
                    <span className="text-muted-foreground text-xs ml-1">
                      ({selectedJob.successRecords} unique after dedup)
                    </span>
                  ) : null}
                </div>
                <div>
                  <span className="text-muted-foreground">Validation:</span>{" "}
                  <span className="text-green-500">{selectedJob.successRecords} valid</span>
                  {selectedJob.failedRecords > 0 ? (
                    <>
                      {" / "}
                      <span className="text-red-500">{selectedJob.failedRecords} invalid</span>
                    </>
                  ) : null}
                </div>
                <div>
                  <span className="text-muted-foreground">Started:</span> {formatDate(selectedJob.startedAt)}
                </div>
                <div>
                  <span className="text-muted-foreground">Completed:</span> {formatDate(selectedJob.completedAt)}
                </div>
              </div>

              {/* Phase Status */}
              <div>
                <h4 className="font-medium mb-2">
                  Phase Status
                  {selectedJob.totalChunks ? (
                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                      ({selectedJob.preparedChunks ?? 0} / {selectedJob.totalChunks} chunks prepared)
                    </span>
                  ) : null}
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {(["POSTGRES", "PINECONE", "NEO4J"] as const).map((backend) => {
                    const label = backend === "POSTGRES" ? "PostgreSQL" : backend === "PINECONE" ? "Pinecone" : "Neo4j";
                    const phase = backend === "POSTGRES" ? selectedJob.postgresStatus
                      : backend === "PINECONE" ? selectedJob.pineconeStatus
                      : selectedJob.neo4jStatus;
                    const counts = selectedJob.backendBreakdown?.[backend];
                    const total = counts ? counts.PENDING + counts.IN_PROGRESS + counts.OK + counts.FAILED + counts.REJECTED : 0;
                    const recordsOk = backend === "POSTGRES" ? selectedJob.postgresSuccessRecords
                      : backend === "PINECONE" ? selectedJob.pineconeSuccessRecords
                      : selectedJob.neo4jSuccessRecords;
                    const recordsFailed = backend === "POSTGRES" ? selectedJob.postgresFailedRecords
                      : backend === "PINECONE" ? selectedJob.pineconeFailedRecords
                      : selectedJob.neo4jFailedRecords;
                    return (
                      <div key={backend} className="border rounded-lg p-3 text-center">
                        <div className="text-sm font-medium">{label}</div>
                        <div className={`text-xs mt-1 ${PHASE_CONFIG[phase]?.color}`}>{phase}</div>
                        {counts && total > 0 ? (
                          <div className="text-[11px] mt-2 space-y-0.5 text-left">
                            {counts.OK > 0 && <div className="text-green-500">Chunks OK: {counts.OK} / {total}</div>}
                            {counts.IN_PROGRESS > 0 && <div className="text-blue-500">Running: {counts.IN_PROGRESS}</div>}
                            {counts.PENDING > 0 && <div className="text-muted-foreground">Pending: {counts.PENDING}</div>}
                            {counts.FAILED > 0 && <div className="text-red-500">Failed: {counts.FAILED}</div>}
                            {counts.REJECTED > 0 && <div className="text-orange-500">Rejected: {counts.REJECTED}</div>}
                          </div>
                        ) : null}
                        {(typeof recordsOk === 'number' && recordsOk > 0) || (typeof recordsFailed === 'number' && recordsFailed > 0) ? (
                          <div className="text-[11px] mt-2 pt-2 border-t text-left">
                            <div className="text-green-500">Records written: {recordsOk ?? 0}</div>
                            {typeof recordsFailed === 'number' && recordsFailed > 0 ? (
                              <div className="text-red-500">Records failed: {recordsFailed}</div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Options */}
              {selectedJob.options && (
                <div>
                  <h4 className="font-medium mb-2">Options</h4>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedJob.options, null, 2)}
                  </pre>
                </div>
              )}

              {/* Errors */}
              {selectedJob.errors && Array.isArray(selectedJob.errors) && selectedJob.errors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-red-500">
                    Errors ({selectedJob.errors.length})
                  </h4>
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 max-h-60 overflow-y-auto">
                    {selectedJob.errors.slice(0, 50).map((err: any, i: number) => (
                      <div key={i} className="text-xs py-1 border-b last:border-b-0 border-red-100 dark:border-red-900">
                        <span className="text-muted-foreground">Row {err.row}:</span>{" "}
                        <span className="font-medium">{err.field}</span> - {err.message}
                        {err.value && <span className="text-muted-foreground ml-1">({String(err.value)})</span>}
                      </div>
                    ))}
                    {selectedJob.errors.length > 50 && (
                      <div className="text-xs text-muted-foreground mt-2">
                        ... and {selectedJob.errors.length - 50} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
