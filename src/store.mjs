import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const NEXT = {
  booked: ['in_transit', 'exception'],
  in_transit: ['delivered', 'exception'],
  exception: ['in_transit', 'delivered'],
  delivered: []
};

export function createStore(file) {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    reference TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id TEXT NOT NULL,
    status TEXT NOT NULL,
    at TEXT NOT NULL
  )`);
  const insertShipment = db.prepare('INSERT INTO shipments (id, origin, destination, reference, status, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const insertEvent = db.prepare('INSERT INTO events (shipment_id, status, at) VALUES (?, ?, ?)');
  const readShipment = db.prepare('SELECT id, origin, destination, reference, status, created_at FROM shipments WHERE id = ?');
  const readEvents = db.prepare('SELECT status, at FROM events WHERE shipment_id = ? ORDER BY id');
  return {
    ping() { db.prepare('SELECT 1').get(); },
    create(input) {
      const now = new Date().toISOString();
      insertShipment.run(input.id, input.origin, input.destination, input.reference, 'booked', now);
      insertEvent.run(input.id, 'booked', now);
      return this.get(input.id);
    },
    get(id) {
      const row = readShipment.get(id);
      if (!row) return undefined;
      return { ...row, events: readEvents.all(id) };
    },
    transition(id, status) {
      const current = this.get(id);
      if (!current) return { error: 'missing' };
      if (!NEXT[current.status].includes(status)) return { error: 'conflict', from: current.status };
      const now = new Date().toISOString();
      db.prepare('UPDATE shipments SET status = ? WHERE id = ?').run(status, id);
      insertEvent.run(id, status, now);
      return { shipment: this.get(id) };
    }
  };
}
