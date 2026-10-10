export function createMetrics() {
  const requests = new Map();
  let durationSum = 0;
  let durationCount = 0;
  let created = 0;
  return {
    record(method, route, status, seconds) {
      const key = `${method}|${route}|${status}`;
      requests.set(key, (requests.get(key) || 0) + 1);
      durationSum += seconds;
      durationCount += 1;
    },
    shipment() { created += 1; },
    render() {
      const lines = [
        '# HELP northline_up Process is serving traffic.',
        '# TYPE northline_up gauge',
        'northline_up 1',
        '# HELP northline_http_requests_total HTTP requests.',
        '# TYPE northline_http_requests_total counter'
      ];
      for (const [key, value] of requests) {
        const [method, route, status] = key.split('|');
        lines.push(`northline_http_requests_total{method="${method}",route="${route}",status="${status}"} ${value}`);
      }
      lines.push(
        '# HELP northline_http_request_duration_seconds Request duration.',
        '# TYPE northline_http_request_duration_seconds summary',
        `northline_http_request_duration_seconds_sum ${durationSum}`,
        `northline_http_request_duration_seconds_count ${durationCount}`,
        '# HELP northline_shipments_created_total Shipments accepted.',
        '# TYPE northline_shipments_created_total counter',
        `northline_shipments_created_total ${created}`
      );
      return `${lines.join('\n')}\n`;
    }
  };
}
