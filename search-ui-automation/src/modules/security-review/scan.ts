const SECRET_PATTERNS: Array<{ id: string; re: RegExp; title: string }> = [
  { id: 'aws-key', re: /AKIA[0-9A-Z]{16}/g, title: 'Possible AWS access key' },
  { id: 'google-api', re: /AIza[0-9A-Za-z\-_]{35}/g, title: 'Possible Google API key' },
  { id: 'stripe-live', re: /sk_live_[0-9A-Za-z]{16,}/g, title: 'Possible Stripe live secret' },
  {
    id: 'generic-secret',
    re: /(?:api[_-]?key|apikey|client_secret|private_key|secret_key)\s*[:=]\s*['"][^'"]{16,}['"]/gi,
    title: 'Hardcoded secret-like assignment',
  },
  {
    id: 'bearer',
    re: /Bearer\s+[A-Za-z0-9\-._~+/]{20,}=*/g,
    title: 'Bearer token in client source',
  },
];

const SOURCE_MAP_RE = /\/\/[#@]\s*sourceMappingURL=\s*(\S+)/g;
const DEBUG_TEXT_RE =
  /\b(TODO|FIXME|debugger|lorem ipsum|look at julian|console\.(log|debug|info)\()/gi;

export type ScanHit = {
  id: string;
  title: string;
  excerpt: string;
  source: string;
};

export function scanTextForSecrets(text: string, source: string, limit = 8): ScanHit[] {
  const hits: ScanHit[] = [];
  for (const pattern of SECRET_PATTERNS) {
    pattern.re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.re.exec(text)) && hits.length < limit) {
      hits.push({
        id: pattern.id,
        title: pattern.title,
        excerpt: redact(match[0]),
        source,
      });
    }
  }
  return hits;
}

export function scanSourceMaps(text: string, source: string): ScanHit[] {
  const hits: ScanHit[] = [];
  SOURCE_MAP_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SOURCE_MAP_RE.exec(text))) {
    hits.push({
      id: 'sourcemap',
      title: 'Source map reference',
      excerpt: match[1],
      source,
    });
  }
  return hits;
}

export function scanDebugArtifacts(text: string, source: string, limit = 6): ScanHit[] {
  const hits: ScanHit[] = [];
  DEBUG_TEXT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DEBUG_TEXT_RE.exec(text)) && hits.length < limit) {
    const start = Math.max(0, match.index - 40);
    const excerpt = text.slice(start, match.index + match[0].length + 40).replace(/\s+/g, ' ');
    hits.push({
      id: 'debug',
      title: `Debug / leftover text (${match[0]})`,
      excerpt,
      source,
    });
  }
  return hits;
}

function redact(value: string): string {
  if (value.length <= 10) return '[redacted]';
  return `${value.slice(0, 6)}…${value.slice(-3)}`;
}
