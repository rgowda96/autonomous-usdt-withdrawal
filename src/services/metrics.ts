// Minimal Prometheus text-exposition implementation. No deps.
// Stable enough for v0; swap for prom-client later if cardinality grows.

type LabelMap = Record<string, string>;
type CounterEntry = { value: number };

const counters = new Map<string, CounterEntry>();
const histograms = new Map<string, { buckets: number[]; counts: number[]; sum: number; count: number }>();

function labelString(labels: LabelMap): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return "";
  return "{" + keys.map((k) => `${k}="${labels[k]!.replace(/"/g, '\\"')}"`).join(",") + "}";
}
function key(name: string, labels: LabelMap): string {
  return `${name}${labelString(labels)}`;
}

export function incCounter(name: string, labels: LabelMap = {}, value: number = 1) {
  const k = key(name, labels);
  const c = counters.get(k);
  if (c) c.value += value;
  else counters.set(k, { value });
}

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export function observeHistogram(name: string, labels: LabelMap, valueMs: number) {
  const k = key(name, labels);
  let h = histograms.get(k);
  if (!h) {
    h = { buckets: DEFAULT_BUCKETS, counts: new Array(DEFAULT_BUCKETS.length).fill(0), sum: 0, count: 0 };
    histograms.set(k, h);
  }
  for (let i = 0; i < h.buckets.length; i++) {
    if (valueMs <= h.buckets[i]!) h.counts[i]!++;
  }
  h.sum += valueMs;
  h.count++;
}

export function renderMetrics(): string {
  const lines: string[] = [];

  // Counters grouped by metric name
  const counterByName = new Map<string, string[]>();
  for (const [k, c] of counters.entries()) {
    const name = k.split("{")[0]!;
    if (!counterByName.has(name)) counterByName.set(name, []);
    counterByName.get(name)!.push(`${k} ${c.value}`);
  }
  for (const [name, body] of counterByName.entries()) {
    lines.push(`# TYPE ${name} counter`);
    lines.push(...body);
  }

  // Histograms
  for (const [k, h] of histograms.entries()) {
    const name = k.split("{")[0]!;
    const labelStr = k.slice(name.length);
    lines.push(`# TYPE ${name} histogram`);
    for (let i = 0; i < h.buckets.length; i++) {
      const sep = labelStr === "" ? `{le="${h.buckets[i]}"}` : labelStr.replace("}", `,le="${h.buckets[i]}"}`);
      lines.push(`${name}_bucket${sep} ${h.counts[i]}`);
    }
    const infSep = labelStr === "" ? `{le="+Inf"}` : labelStr.replace("}", `,le="+Inf"}`);
    lines.push(`${name}_bucket${infSep} ${h.count}`);
    lines.push(`${name}_sum${labelStr} ${h.sum}`);
    lines.push(`${name}_count${labelStr} ${h.count}`);
  }
  return lines.join("\n") + "\n";
}

// Test-only
export function _resetMetrics() {
  counters.clear();
  histograms.clear();
}
