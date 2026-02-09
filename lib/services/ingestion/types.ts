export interface IngestionFileMetadata {
  manufacturer?: string;
  machineModel?: string;
  namespace?: string;
  technicalDomain?: string;
  sourceUrl?: string;
  serialNumberRange?: string;
}

export interface MergedEntry {
  diagramTitle?: string;
  quantity?: string;
  remarks?: string;
  sourceUrl?: string;
  partKey?: number;
}

export interface PartIngestionRecord {
  partKey?: number;
  partNumber: string;
  partTitle: string;
  manufacturer: string;
  machineModel: string;
  namespace?: string;
  categoryBreadcrumb?: string;
  diagramTitle?: string;
  serialNumberRange?: string;
  technicalDomain?: string;
  quantity?: string;
  remarks?: string;
  sourceUrl?: string;
  price?: number;
  cost?: number;
  relatedParts?: string[];
  requiredParts?: string[];
  mergedEntries?: MergedEntry[];
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

export interface ValidationWarning {
  row: number;
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  valid: PartIngestionRecord[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface PhaseResult {
  success: number;
  failed: number;
  errors: ValidationError[];
}

export interface IngestionProgress {
  percent: number;
  phase: 'validating' | 'postgres' | 'pinecone' | 'neo4j' | 'completed';
  processed: number;
  total: number;
  success: number;
  failed: number;
  postgresStatus: string;
  pineconeStatus: string;
  neo4jStatus: string;
  overallStatus: string;
}
