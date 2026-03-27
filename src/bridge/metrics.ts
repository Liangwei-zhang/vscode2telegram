// bridge/metrics.ts - 指標收集
interface MetricPoint {
  value: number;
  timestamp: number;
}

interface Counter {
  total: number;
  byUser: Map<number, number>;
  history: MetricPoint[];
}

interface Gauge {
  value: number;
  timestamp: number;
}

interface Histogram {
  values: number[];
  count: number;
  sum: number;
}

class Metrics {
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();
  private histograms = new Map<string, Histogram>();
  private maxHistoryPoints = 1000;

  // 計數器
  incrementCounter(name: string, userId?: number) {
    if (!this.counters.has(name)) {
      this.counters.set(name, {
        total: 0,
        byUser: new Map(),
        history: []
      });
    }
    
    const counter = this.counters.get(name)!;
    counter.total++;
    
    if (userId) {
      counter.byUser.set(userId, (counter.byUser.get(userId) || 0) + 1);
    }

    // 記錄歷史
    this.recordHistory(counter.history, counter.total);
  }

  getCounter(name: string): { total: number; byUser: Record<number, number> } | null {
    const counter = this.counters.get(name);
    if (!counter) return null;
    
    return {
      total: counter.total,
      byUser: Object.fromEntries(counter.byUser)
    };
  }

  // 儀表
  setGauge(name: string, value: number) {
    this.gauges.set(name, {
      value,
      timestamp: Date.now()
    });
  }

  getGauge(name: string): number | null {
    return this.gauges.get(name)?.value ?? null;
  }

  // 直方圖
  recordHistogram(name: string, value: number) {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, { values: [], count: 0, sum: 0 });
    }
    
    const hist = this.histograms.get(name)!;
    hist.values.push(value);
    hist.count++;
    hist.sum += value;

    // 保持固定數量
    if (hist.values.length > this.maxHistoryPoints) {
      const removed = hist.values.shift();
      hist.sum -= removed || 0;
    }
  }

  getHistogram(name: string): { count: number; avg: number; min: number; max: number; p50: number; p95: number; p99: number } | null {
    const hist = this.histograms.get(name);
    if (!hist || hist.count === 0) return null;

    const sorted = [...hist.values].sort((a, b) => a - b);
    const getPercentile = (p: number) => sorted[Math.floor(sorted.length * p)] || 0;

    return {
      count: hist.count,
      avg: hist.sum / hist.count,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: getPercentile(0.5),
      p95: getPercentile(0.95),
      p99: getPercentile(0.99)
    };
  }

  // 獲取所有指標
  getAll(): {
    counters: Record<string, { total: number; byUser: Record<number, number> }>;
    gauges: Record<string, number>;
    histograms: Record<string, any>;
  } {
    const counters: Record<string, any> = {};
    const gauges: Record<string, number> = {};
    const histograms: Record<string, any> = {};

    for (const [name, counter] of this.counters) {
      counters[name] = { total: counter.total, byUser: Object.fromEntries(counter.byUser) };
    }

    for (const [name, gauge] of this.gauges) {
      gauges[name] = gauge.value;
    }

    for (const [name, hist] of this.histograms) {
      histograms[name] = this.getHistogram(name);
    }

    return { counters, gauges, histograms };
  }

  // 重置
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private recordHistory(history: MetricPoint[], value: number) {
    history.push({ value, timestamp: Date.now() });
    if (history.length > this.maxHistoryPoints) {
      history.shift();
    }
  }
}

export const metrics = new Metrics();

// 預設指標
export function initDefaultMetrics() {
  metrics.setGauge('uptime', 0);
  metrics.setGauge('memory_usage', 0);
  metrics.setGauge('cpu_usage', 0);
}

// 定期更新
setInterval(() => {
  metrics.setGauge('uptime', Date.now());
  
  // 可以添加更多系統指標
  const mem = process.memoryUsage();
  metrics.setGauge('memory_usage', Math.round(mem.heapUsed / 1024 / 1024)); // MB
}, 5000);