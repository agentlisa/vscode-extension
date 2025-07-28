export interface ScanFile {
  path: string;
  content: string;
}

export interface ScanMetadata {
  projectName?: string;
  workspaceName?: string;
  [key: string]: any;
}

export interface ScanRequest {
  title: string;
  files: ScanFile[];
  metadata?: ScanMetadata;
  type: "VSCode" | "Unknown";
}

export interface ScanStartSuccessResponse {
  chatId: string;
  scanId: string;
  success: true;
  status: "processing" | "completed" | "failed" | "cancelled" | "pending";
  message: string;
}

export interface ScanStartErrorResponse {
  success: false;
  message: string;
}

export type ScanStartResponse = ScanStartSuccessResponse | ScanStartErrorResponse;

export interface ScanResultRange {
  start?: {
    line: number;
    column: number;
  };
  end?: {
    line: number;
    column: number;
  };
}

export interface ScanResultAffectedFile {
  filePath: string;
  range?: ScanResultRange;
}

export interface ScanResultIssue {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "WARN" | "INFORMATIONAL";
  title: string;
  description?: string;
  recommendation?: string;
  affectedFiles: ScanResultAffectedFile[];
}

export interface ScanResult {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  completedAt: string | null;
  disclosure: "NONE" | "PARTIAL" | "FULL";
  status: "processing" | "completed" | "failed" | "cancelled" | "pending";
  metadata?: { [key: string]: any } | null;
  result: ScanResultIssue[];
  codeSummary?: string | null;
}

export interface ScanResultSummary {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "WARN" | "INFORMATIONAL";
  count: number;
}

export interface ScanListItem {
  id: string;
  status: "processing" | "completed" | "failed" | "cancelled" | "pending";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  title: string;
  resultSummary: ScanResultSummary[];
  tags: string[];
  likeCount: number;
}

export interface ScanListResponse {
  items: ScanListItem[];
  nextCursor?: string;
  hasMore: boolean;
}


export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface OAuthWellKnownConfig {
  authorization_data_locations_supported: string[];
  authorization_data_types_supported: string[];
  authorization_servers: string[];
  jwks_uri: string;
  key_challenges_supported: Array<{
    challenge_algs: string[];
    challenge_type: string;
  }>;
  resource: string;
  service_documentation: string;
  token_introspection_endpoint: string;
  token_introspection_endpoint_auth_methods_supported: string[];
  token_types_supported: string[];
}
