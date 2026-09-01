export type Source = "bought" | "saved" | "swapped" | "gifted";
export type Quantity = "full" | "partial" | "nearly_empty";
export type Status = "expired" | "expiring" | "fresh";

export const SOURCES: Source[] = ["bought", "saved", "swapped", "gifted"];
export const QUANTITIES: Quantity[] = ["full", "partial", "nearly_empty"];
export const SOURCE_LABELS: Record<Source, string> = {
  bought: "Bought",
  saved: "Saved",
  swapped: "Swapped",
  gifted: "Gifted",
};
export const QUANTITY_LABELS: Record<Quantity, string> = {
  full: "Full packet",
  partial: "Partial",
  nearly_empty: "Nearly empty",
};

export interface SeedPacket {
  id: string;
  name: string;
  source: Source;
  packetYear: number;
  expirationYear: number;
  quantity: Quantity;
  notes: string;
}

export interface FormInput {
  name: string;
  source: Source;
  packetYear: string;
  expirationYear: string;
  quantity: Quantity;
  notes: string;
}

export interface Stats {
  total: number;
  expiring: number;
  expired: number;
  bySource: Record<Source, number>;
}

export const STORAGE_KEY = "seedvault:v1";
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

export const currentYear = (): number => new Date().getFullYear();

export const getStatus = (p: SeedPacket, year: number): Status => {
  if (p.expirationYear < year) return "expired";
  if (p.expirationYear === year) return "expiring";
  return "fresh";
};

const isYear = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= YEAR_MIN && v <= YEAR_MAX;

const isSource = (v: unknown): v is Source =>
  typeof v === "string" && (SOURCES as string[]).includes(v);

const isQuantity = (v: unknown): v is Quantity =>
  typeof v === "string" && (QUANTITIES as string[]).includes(v);

export const newId = (): string => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const sanitizePacket = (raw: unknown): SeedPacket | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || !r.name.trim()) return null;
  if (!isSource(r.source) || !isQuantity(r.quantity)) return null;
  if (!isYear(r.packetYear) || !isYear(r.expirationYear)) return null;
  if (r.expirationYear < r.packetYear) return null;
  return {
    id: typeof r.id === "string" && r.id ? r.id : newId(),
    name: r.name.trim().slice(0, 120),
    source: r.source,
    packetYear: r.packetYear,
    expirationYear: r.expirationYear,
    quantity: r.quantity,
    notes: typeof r.notes === "string" ? r.notes.slice(0, 1000) : "",
  };
};

export interface LoadResult {
  packets: SeedPacket[];
  corrupt: boolean;
}

export const loadPackets = (storage: Storage | null): LoadResult => {
  if (!storage) return { packets: [], corrupt: false };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { packets: [], corrupt: true };
  }
  if (!raw) return { packets: [], corrupt: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { packets: [], corrupt: true };
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== 1 || !Array.isArray(obj.packets)) return { packets: [], corrupt: true };
    const packets = obj.packets
      .map(sanitizePacket)
      .filter((p): p is SeedPacket => p !== null);
    return { packets, corrupt: packets.length !== obj.packets.length };
  } catch {
    return { packets: [], corrupt: true };
  }
};

export const savePackets = (storage: Storage | null, packets: SeedPacket[]): boolean => {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, packets }));
    return true;
  } catch {
    return false;
  }
};

const parseYear = (v: string): number | null => {
  const n = Number(v);
  if (!v || !Number.isInteger(n)) return null;
  return n;
};

export type FormErrors = Partial<Record<"name" | "packetYear" | "expirationYear", string>>;

export const validateForm = (f: FormInput): FormErrors => {
  const errors: FormErrors = {};
  if (!f.name.trim()) errors.name = "Plant name is required.";
  const py = parseYear(f.packetYear);
  if (py === null) {
    errors.packetYear = `Enter a whole year between ${YEAR_MIN} and ${YEAR_MAX}.`;
  } else if (py < YEAR_MIN || py > YEAR_MAX) {
    errors.packetYear = `Year must be between ${YEAR_MIN} and ${YEAR_MAX}.`;
  }
  const ey = parseYear(f.expirationYear);
  if (ey === null) {
    errors.expirationYear = `Enter a whole year between ${YEAR_MIN} and ${YEAR_MAX}.`;
  } else if (ey < YEAR_MIN || ey > YEAR_MAX) {
    errors.expirationYear = `Year must be between ${YEAR_MIN} and ${YEAR_MAX}.`;
  } else if (py !== null && ey < py) {
    errors.expirationYear = "Expiration cannot be before the packet year.";
  }
  return errors;
};

export const computeStats = (packets: SeedPacket[], year: number): Stats => {
  const bySource: Record<Source, number> = { bought: 0, saved: 0, swapped: 0, gifted: 0 };
  let expiring = 0;
  let expired = 0;
  for (const p of packets) {
    bySource[p.source] += 1;
    const s = getStatus(p, year);
    if (s === "expiring") expiring += 1;
    if (s === "expired") expired += 1;
  }
  return { total: packets.length, expiring, expired, bySource };
};

export const sortPackets = (packets: SeedPacket[], desc: boolean): SeedPacket[] =>
  [...packets].sort((a, b) =>
    desc
      ? b.expirationYear - a.expirationYear || a.name.localeCompare(b.name)
      : a.expirationYear - b.expirationYear || a.name.localeCompare(b.name),
  );
