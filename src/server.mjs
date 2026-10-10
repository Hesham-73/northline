import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStore } from './store.mjs';
import { createMetrics } from './metrics.mjs';
import { log } from './log.mjs';

const STATUSES = new Set(['in_transit', 'delivered', 'exception']);

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 100_000) reject(Object.assign(new Error('body too large'), { status: 413 }));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('invalid json'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function field(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120 ? value.trim() : undefined;
}

export function createApp({ store, metrics }) {
  return async function app(req, res) {
    const started = process.hrtime.bigint();
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let route = 'other';
    let status = 500;
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        route = '/health'; status = 200; send(res, 200, { status: 'ok' }); return;
      }
      if (req.method === 'GET' && url.pathname === '/ready') {
        route = '/ready';
        try { store.ping(); status = 200; send(res, 200, { status: 'ready' }); }
        catch { status = 503; send(res, 503, { status: 'not-ready' }); }
        return;
      }
      if (req.method === 'GET' && url.pathname === '/metrics') {
        route = '/metrics'; status = 200; send(res, 200, metrics.render(), 'text/plain; version=0.0.4; charset=utf-8'); return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/shipments') {
        route = '/v1/shipments';
        const body = await readJson(req);
        const origin = field(body.origin), destination = field(body.destination), reference = field(body.reference);
        if (!origin || !destination || !reference) { status = 400; send(res, 400, { error: 'origin, destination, and reference are required' }); return; }
        const shipment = store.create({ id: randomUUID(), origin, destination, reference });
        metrics.shipment();
        status = 201; send(res, 201, shipment); return;
      }
      const match = url.pathname.match(/^\/v1\/shipments\/([0-9a-f-]{36})(\/events)?$/);
      if (match && req.method === 'GET' && !match[2]) {
        route = '/v1/shipments/:id';
        const shipment = store.get(match[1]);
        if (!shipment) { status = 404; send(res, 404, { error: 'not found' }); return; }
        status = 200; send(res, 200, shipment); return;
      }
      if (match && req.method === 'POST' && match[2]) {
        route = '/v1/shipments/:id/events';
        const body = await readJson(req);
        if (!STATUSES.has(body.status)) { status = 400; send(res, 400, { error: 'status must be in_transit, delivered, or exception' }); return; }
        const result = store.transition(match[1], body.status);
        if (result.error === 'missing') { status = 404; send(res, 404, { error: 'not found' }); return; }
        if (result.error === 'conflict') { status = 409; send(res, 409, { error: `cannot move from ${result.from} to ${body.status}` }); return; }
        status = 200; send(res, 200, result.shipment); return;
      }
      route = 'other'; status = 404; send(res, 404, { error: 'not found' });
    } catch (error) {
      status = error.status || 500;
      send(res, status, { error: status === 500 ? 'internal error' : error.message });
      if (status === 500) log('error', 'request failed', { error: error.message });
    } finally {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      metrics.record(req.method || 'GET', route, status, seconds);
      log('info', 'request', { method: req.method, route, status, seconds: Number(seconds.toFixed(6)) });
    }
  };
}

export function start(options = {}) {
  const file = options.dataPath || process.env.DATA_PATH || path.join(process.cwd(), 'data', 'northline.sqlite');
  const store = options.store || createStore(file);
  const metrics = options.metrics || createMetrics();
  const server = createServer(createApp({ store, metrics }));
  const port = Number(options.port ?? process.env.PORT ?? 8080);
  return new Promise(resolve => {
    server.listen(port, '0.0.0.0', () => {
      const address = server.address();
      log('info', 'listening', { port: address.port });
      resolve({ server, port: address.port, store, metrics });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
