import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../src/server.mjs';

async function boot() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'northline-'));
  const app = await start({ port: 0, dataPath: path.join(dir, 'northline.sqlite') });
  return { ...app, dir, base: `http://127.0.0.1:${app.port}` };
}

test('health, ready, create, move, and metrics', async () => {
  const app = await boot();
  try {
    const health = await fetch(`${app.base}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.equal((await fetch(`${app.base}/ready`)).status, 200);

    const created = await fetch(`${app.base}/v1/shipments`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ origin: 'Cairo', destination: 'Alexandria', reference: 'NL-1001' })
    });
    assert.equal(created.status, 201);
    const shipment = await created.json();
    assert.equal(shipment.status, 'booked');
    assert.equal(shipment.events.length, 1);

    const moved = await fetch(`${app.base}/v1/shipments/${shipment.id}/events`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'in_transit' })
    });
    assert.equal(moved.status, 200);
    assert.equal((await moved.json()).status, 'in_transit');

    const skipped = await fetch(`${app.base}/v1/shipments/${shipment.id}/events`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'booked' })
    });
    assert.equal(skipped.status, 400);

    const conflict = await fetch(`${app.base}/v1/shipments/${shipment.id}/events`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'in_transit' })
    });
    assert.equal(conflict.status, 409);

    const metrics = await (await fetch(`${app.base}/metrics`)).text();
    assert.match(metrics, /northline_shipments_created_total 1/);
    assert.match(metrics, /northline_up 1/);
  } finally {
    app.server.close();
    await once(app.server, 'close');
    await rm(app.dir, { recursive: true, force: true });
  }
});

test('rejects incomplete shipments and unknown ids', async () => {
  const app = await boot();
  try {
    const rejected = await fetch(`${app.base}/v1/shipments`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ origin: 'Cairo' })
    });
    assert.equal(rejected.status, 400);
    assert.equal((await fetch(`${app.base}/v1/shipments/11111111-1111-1111-1111-111111111111`)).status, 404);
  } finally {
    app.server.close();
    await once(app.server, 'close');
    await rm(app.dir, { recursive: true, force: true });
  }
});
