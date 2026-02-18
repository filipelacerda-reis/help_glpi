type Labels = Record<string, string | number | boolean | undefined>;

type CounterMetric = {
  name: string;
  help: string;
  value: number;
  labels: Labels;
};

type GaugeMetric = {
  name: string;
  help: string;
  value: number;
  labels: Labels;
};

type HistogramMetric = {
  name: string;
  help: string;
  buckets: number[];
  counts: Map<number, number>;
  sum: number;
  count: number;
  labels: Labels;
};

const DEFAULT_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

const normalizeLabels = (labels?: Labels): Labels => {
  if (!labels) return {};
  const entries = Object.entries(labels)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, String(value)]);
  return Object.fromEntries(entries);
};

const metricKey = (name: string, labels?: Labels) => `${name}:${JSON.stringify(normalizeLabels(labels))}`;

const renderLabels = (labels?: Labels) => {
  const normalized = normalizeLabels(labels);
  const entries = Object.entries(normalized);
  if (!entries.length) return '';
  const rendered = entries.map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`).join(',');
  return `{${rendered}}`;
};

class MetricsRegistry {
  private counters = new Map<string, CounterMetric>();
  private gauges = new Map<string, GaugeMetric>();
  private histograms = new Map<string, HistogramMetric>();

  incCounter(name: string, help: string, labels?: Labels, value = 1) {
    const key = metricKey(name, labels);
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += value;
      return;
    }
    this.counters.set(key, {
      name,
      help,
      value,
      labels: normalizeLabels(labels),
    });
  }

  setGauge(name: string, help: string, labels: Labels | undefined, value: number) {
    const key = metricKey(name, labels);
    this.gauges.set(key, {
      name,
      help,
      value,
      labels: normalizeLabels(labels),
    });
  }

  observeHistogram(
    name: string,
    help: string,
    valueSeconds: number,
    labels?: Labels,
    buckets = DEFAULT_BUCKETS_SECONDS
  ) {
    const key = metricKey(name, labels);
    let metric = this.histograms.get(key);
    if (!metric) {
      metric = {
        name,
        help,
        buckets,
        counts: new Map<number, number>(),
        sum: 0,
        count: 0,
        labels: normalizeLabels(labels),
      };
      for (const bucket of buckets) {
        metric.counts.set(bucket, 0);
      }
      this.histograms.set(key, metric);
    }

    metric.sum += valueSeconds;
    metric.count += 1;
    for (const bucket of metric.buckets) {
      if (valueSeconds <= bucket) {
        metric.counts.set(bucket, (metric.counts.get(bucket) || 0) + 1);
      }
    }
  }

  renderPrometheus(): string {
    const lines: string[] = [];

    for (const metric of this.counters.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} counter`);
      lines.push(`${metric.name}${renderLabels(metric.labels)} ${metric.value}`);
    }

    for (const metric of this.gauges.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} gauge`);
      lines.push(`${metric.name}${renderLabels(metric.labels)} ${metric.value}`);
    }

    for (const metric of this.histograms.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} histogram`);

      for (const bucket of metric.buckets) {
        const labels = { ...metric.labels, le: bucket };
        lines.push(`${metric.name}_bucket${renderLabels(labels)} ${metric.counts.get(bucket) || 0}`);
      }
      lines.push(`${metric.name}_bucket${renderLabels({ ...metric.labels, le: '+Inf' })} ${metric.count}`);
      lines.push(`${metric.name}_sum${renderLabels(metric.labels)} ${metric.sum}`);
      lines.push(`${metric.name}_count${renderLabels(metric.labels)} ${metric.count}`);
    }

    return `${lines.join('\n')}\n`;
  }
}

export const metricsRegistry = new MetricsRegistry();

