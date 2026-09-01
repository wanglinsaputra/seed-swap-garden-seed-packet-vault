import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeStats,
  getStatus,
  loadPackets,
  sanitizePacket,
  savePackets,
  sortPackets,
  validateForm,
  type SeedPacket,
} from "./logic.ts";

const pkt = (over: Partial<SeedPacket> = {}): SeedPacket => ({
  id: "x1",
  name: "Cherry Tomato – Sun Gold",
  source: "saved",
  packetYear: 2024,
  expirationYear: 2026,
  quantity: "partial",
  notes: "great germination last spring",
  ...over,
});

test("getStatus boundaries", () => {
  assert.equal(getStatus(pkt({ expirationYear: 2025 }), 2026), "expired");
  assert.equal(getStatus(pkt({ expirationYear: 2026 }), 2026), "expiring");
  assert.equal(getStatus(pkt({ expirationYear: 2027 }), 2026), "fresh");
});

test("sanitizePacket accepts valid and drops invalid", () => {
  const p = pkt({ id: "" });
  const out = sanitizePacket(p);
  assert.ok(out && out.id !== "", "fills missing id");
  assert.equal(sanitizePacket(null), null);
  assert.equal(sanitizePacket("nope"), null);
  assert.equal(sanitizePacket(pkt({ name: "  " })), null);
  assert.equal(sanitizePacket(pkt({ source: "stolen" as never })), null);
  assert.equal(sanitizePacket(pkt({ quantity: "half" as never })), null);
  assert.equal(sanitizePacket(pkt({ packetYear: 2026.5 })), null);
  assert.equal(sanitizePacket(pkt({ expirationYear: 99999 })), null);
  assert.equal(sanitizePacket(pkt({ packetYear: 2027, expirationYear: 2026 })), null);
  const trimmed = sanitizePacket(pkt({ name: "  Pea 'Alderman'  " }));
  assert.equal(trimmed?.name, "Pea 'Alderman'");
  assert.equal(sanitizePacket(pkt({ notes: 42 as never }))?.notes, "");
});

const fakeStorage = (data: string | null, fail = false) => ({
  getItem: (_k: string) => {
    if (fail) throw new Error("unavailable");
    return data;
  },
  setItem: (_k: string, _v: string) => {
    if (fail) throw new Error("quota");
  },
});

test("loadPackets handles storage variants", () => {
  assert.deepEqual(loadPackets(null), { packets: [], corrupt: false });
  const ok = JSON.stringify({ version: 1, packets: [pkt()] });
  assert.deepEqual(loadPackets(fakeStorage(ok) as unknown as Storage), {
    packets: [pkt()],
    corrupt: false,
  });
  assert.deepEqual(loadPackets(fakeStorage(null) as unknown as Storage), {
    packets: [],
    corrupt: false,
  });
  const bad = loadPackets(fakeStorage("not json") as unknown as Storage);
  assert.equal(bad.corrupt, true);
  assert.equal(bad.packets.length, 0);
  const wrong = loadPackets(
    fakeStorage('{"version":2,"packets":[]}') as unknown as Storage,
  );
  assert.equal(wrong.corrupt, true);
  const mixed = loadPackets(
    fakeStorage(
      JSON.stringify({ version: 1, packets: [pkt(), { junk: true }] }),
    ) as unknown as Storage,
  );
  assert.equal(mixed.packets.length, 1);
  assert.equal(mixed.corrupt, true);
  assert.deepEqual(loadPackets(fakeStorage(null, true) as unknown as Storage), {
    packets: [],
    corrupt: true,
  });
});

test("savePackets reports write failure", () => {
  const good = fakeStorage(null);
  assert.equal(savePackets(good as unknown as Storage, [pkt()]), true);
  assert.equal(savePackets(fakeStorage(null, true) as unknown as Storage, [pkt()]), false);
  assert.equal(savePackets(null, [pkt()]), false);
});

test("validateForm specific errors", () => {
  assert.deepEqual(validateForm({ name: "", source: "bought", packetYear: "2024", expirationYear: "2026", quantity: "full", notes: "" }), {
    name: "Plant name is required.",
  });
  assert.ok(validateForm({ name: "P", source: "bought", packetYear: "abc", expirationYear: "2026", quantity: "full", notes: "" }).packetYear);
  assert.ok(validateForm({ name: "P", source: "bought", packetYear: "20.5", expirationYear: "2026", quantity: "full", notes: "" }).packetYear);
  assert.ok(validateForm({ name: "P", source: "bought", packetYear: "1800", expirationYear: "2026", quantity: "full", notes: "" }).packetYear);
  const r = validateForm({ name: "P", source: "bought", packetYear: "2027", expirationYear: "2024", quantity: "full", notes: "" });
  assert.equal(r.expirationYear, "Expiration cannot be before the packet year.");
  assert.deepEqual(validateForm({ name: "P", source: "bought", packetYear: "2024", expirationYear: "2026", quantity: "full", notes: "" }), {});
});

test("computeStats invariants", () => {
  const s = computeStats(
    [
      pkt({ source: "bought", expirationYear: 2024 }),
      pkt({ source: "bought", expirationYear: 2026 }),
      pkt({ source: "gifted", expirationYear: 2027 }),
    ],
    2026,
  );
  assert.equal(s.total, 3);
  assert.equal(s.expiring, 1);
  assert.equal(s.expired, 1);
  assert.equal(s.bySource.bought + s.bySource.saved + s.bySource.swapped + s.bySource.gifted, s.total);
  assert.deepEqual(computeStats([], 2026), { total: 0, expiring: 0, expired: 0, bySource: { bought: 0, saved: 0, swapped: 0, gifted: 0 } });
});

test("sortPackets stable with name tiebreak", () => {
  const a = pkt({ id: "a", name: "A pea", expirationYear: 2026 });
  const b = pkt({ id: "b", name: "B bean", expirationYear: 2025 });
  const c = pkt({ id: "c", name: "C corn", expirationYear: 2026 });
  const asc = sortPackets([a, b, c], false);
  assert.deepEqual(asc.map((p) => p.id), ["b", "a", "c"]);
  const desc = sortPackets([a, b, c], true);
  assert.deepEqual(desc.map((p) => p.id), ["a", "c", "b"]);
});
