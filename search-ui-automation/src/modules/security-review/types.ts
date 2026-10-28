export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';

export type FindingCategory =
  | 'Broken Links'
  | 'Client-Side Security'
  | 'HTTP Headers'
  | 'Cookies'
  | 'Authentication'
  | 'Network'
  | 'Console'
  | 'Forms'
  | 'SSL/TLS'
  | 'Sensitive Files'
  | 'Performance'
  | 'Best Practices';

export type Finding = {
  id: string;
  severity: Severity;
  category: FindingCategory;
  title: string;
  description: string;
  evidence: string;
  affectedUrls: string[];
  whyItMatters: string;
  recommendedFix: string;
  confirmed: boolean;
};

export type ProbeResult = {
  url: string;
  method: string;
  status: number | null;
  finalUrl: string | null;
  contentType: string | null;
  headers: Record<string, string>;
  redirected: boolean;
  error: string | null;
  bodyPreview: string;
};

export type CookieRecord = {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expires: number;
};

export type NetworkRecord = {
  method: string;
  url: string;
  resourceType: string;
  status: number | null;
  contentType: string | null;
};

export type ConsoleRecord = {
  type: string;
  text: string;
  location: string;
};

export type FormRecord = {
  pageUrl: string;
  action: string;
  method: string;
  autocomplete: string | null;
  fields: Array<{
    name: string;
    type: string;
    autocomplete: string | null;
  }>;
};

export type TlsInfo = {
  hostname: string;
  authorized: boolean;
  authorizationError: string | null;
  protocol: string | null;
  subject: string | null;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
};

export type SecurityReviewSummary = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  baseURL: string;
  pagesVisited: number;
  requestsObserved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
  total: number;
};

export type SecurityReviewReport = {
  summary: SecurityReviewSummary;
  tls: TlsInfo | null;
  findings: Finding[];
  probes: ProbeResult[];
  cookies: CookieRecord[];
  console: ConsoleRecord[];
  forms: FormRecord[];
  networkHosts: string[];
};
