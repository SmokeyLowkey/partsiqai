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
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";

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
  successRecords: number;
  failedRecords: number;
  postgresStatus: string;
  pineconeStatus: string;
  neo4jStatus: string;
  errors: any[] | null;
  warnings: any[] | null;
  options: any;
  createdAt: string;
  organization: { name: string };
  user: { name: string | null; email: string };
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<any> }> = {
  PENDING: { label: "Pending", variant: "outline", icon: Clock },
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

export default function DataIngestionPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMasterAdmin = session?.user?.role === "MASTER_ADMIN";

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.toLowerCase();
      if (!ext.endsWith(".csv") && !ext.endsWith(".json")) {
        toast({ title: "Invalid file type", description: "Only CSV and JSON files are supported", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

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
      if (options.defaultManufacturer) cleanOptions.defaultManufacturer = options.defaultManufacturer;
      if (options.defaultMachineModel) cleanOptions.defaultMachineModel = options.defaultMachineModel;
      if (options.defaultNamespace) cleanOptions.defaultNamespace = options.defaultNamespace;
      if (options.defaultTechnicalDomain) cleanOptions.defaultTechnicalDomain = options.defaultTechnicalDomain;
      if (options.defaultSerialNumberRange) cleanOptions.defaultSerialNumberRange = options.defaultSerialNumberRange;

      formData.append("options", JSON.stringify(cleanOptions));

      const res = await fetch("/api/admin/ingestion/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

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

          {/* Default Values for CSV */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Default Manufacturer</Label>
              <Input
                id="manufacturer"
                placeholder="e.g., John Deere"
                value={options.defaultManufacturer}
                onChange={(e) => setOptions({ ...options, defaultManufacturer: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="machineModel">Default Machine Model</Label>
              <Input
                id="machineModel"
                placeholder="e.g., 160GLC Excavator"
                value={options.defaultMachineModel}
                onChange={(e) => setOptions({ ...options, defaultMachineModel: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="namespace">Default Namespace</Label>
              <Input
                id="namespace"
                placeholder="e.g., john-deere-160glc"
                value={options.defaultNamespace}
                onChange={(e) => setOptions({ ...options, defaultNamespace: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="technicalDomain">Default Technical Domain</Label>
              <Input
                id="technicalDomain"
                placeholder="e.g., Hydraulics"
                value={options.defaultTechnicalDomain}
                onChange={(e) => setOptions({ ...options, defaultTechnicalDomain: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serialRange">Default Serial Number Range</Label>
              <Input
                id="serialRange"
                placeholder="e.g., 1FF160GX..."
                value={options.defaultSerialNumberRange}
                onChange={(e) => setOptions({ ...options, defaultSerialNumberRange: e.target.value })}
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="skipPostgres"
                checked={options.skipPostgres}
                onCheckedChange={(checked) => setOptions({ ...options, skipPostgres: !!checked })}
              />
              <Label htmlFor="skipPostgres" className="text-sm">Skip PostgreSQL</Label>
            </div>
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

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
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
                </div>
                <div>
                  <span className="text-muted-foreground">Success:</span>{" "}
                  <span className="text-green-500">{selectedJob.successRecords}</span>
                  {" / "}
                  <span className="text-muted-foreground">Failed:</span>{" "}
                  <span className="text-red-500">{selectedJob.failedRecords}</span>
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
                <h4 className="font-medium mb-2">Phase Status</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "PostgreSQL", status: selectedJob.postgresStatus },
                    { label: "Pinecone", status: selectedJob.pineconeStatus },
                    { label: "Neo4j", status: selectedJob.neo4jStatus },
                  ].map((phase) => (
                    <div key={phase.label} className="border rounded-lg p-3 text-center">
                      <div className="text-sm font-medium">{phase.label}</div>
                      <div className={`text-xs mt-1 ${PHASE_CONFIG[phase.status]?.color}`}>
                        {phase.status}
                      </div>
                    </div>
                  ))}
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
