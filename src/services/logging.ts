// Centralized PII redaction for request/response logs.
// Anything that could carry a credential, signature, or full VPA tail
// is masked. Idem keys are kept (UUIDs, not PII).

const REDACT_KEYS = new Set([
  "auth_proof",
  "x-signature",
  "signature",
  "authorization",
  "cookie",
  "pan",
  "aadhaar",
  "passkey",
  "private_key",
  "secret",
  "api_key",
]);

const VPA_RE = /^([^@]+)@(.+)$/;

function maskVpa(v: string): string {
  const m = v.match(VPA_RE);
  if (!m) return v;
  const [, name, bank] = m;
  if (!name) return v;
  const head = name.length <= 2 ? name : name.slice(0, 2);
  return `${head}***@${bank}`;
}

function isVpa(v: unknown): v is string {
  return typeof v === "string" && VPA_RE.test(v);
}

export function redact(input: unknown, depth = 0): unknown {
  if (depth > 6) return "[redacted:max-depth]";
  if (input == null) return input;
  if (typeof input === "string") return isVpa(input) ? maskVpa(input) : input;
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map((x) => redact(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const lk = k.toLowerCase();
    if (REDACT_KEYS.has(lk)) {
      out[k] = "[redacted]";
      continue;
    }
    if (lk === "identifier" && typeof v === "string" && isVpa(v)) {
      out[k] = maskVpa(v);
      continue;
    }
    out[k] = redact(v, depth + 1);
  }
  return out;
}

// pino serializer for fastify req/res; redacts headers + body shallowly.
export const pinoSerializers = {
  req(req: any) {
    return {
      method: req.method,
      url: req.url,
      headers: redact(req.headers),
    };
  },
  res(res: any) {
    return { statusCode: res.statusCode };
  },
};
