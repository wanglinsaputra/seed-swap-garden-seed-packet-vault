import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeStats,
  currentYear,
  getStatus,
  loadPackets,
  newId,
  QUANTITIES,
  QUANTITY_LABELS,
  savePackets,
  sortPackets,
  SOURCES,
  SOURCE_LABELS,
  validateForm,
  type FormErrors,
  type FormInput,
  type Quantity,
  type SeedPacket,
  type Source,
  type Status,
} from "./logic";

const emptyForm = (year: number): FormInput => ({
  name: "",
  source: "bought",
  packetYear: String(year),
  expirationYear: "",
  quantity: "full",
  notes: "",
});

const statusLabel: Record<Status, string> = {
  expired: "Expired",
  expiring: "Expiring this year",
  fresh: "",
};

function PacketCard({
  p,
  year,
  onEdit,
  onDelete,
}: {
  p: SeedPacket;
  year: number;
  onEdit: (p: SeedPacket) => void;
  onDelete: (p: SeedPacket) => void;
}) {
  const status = getStatus(p, year);
  return (
    <article className={`packet ${status !== "fresh" ? `is-${status}` : ""}`}>
      {status !== "fresh" && (
        <span className={`ribbon ribbon-${status}`} aria-hidden="true">
          {status === "expired" ? "Expired" : "Expiring"}
        </span>
      )}
      <header className="packet-band">
        <span>{SOURCE_LABELS[p.source]}</span>
        <span className="packet-stamp" aria-hidden="true">
          {SOURCE_LABELS[p.source].charAt(0)}
        </span>
      </header>
      <div className="packet-body">
        <h3 className="packet-name">{p.name}</h3>
        <p className="packet-year">
          Sow by <strong>{p.expirationYear}</strong>
          {status !== "fresh" && <span className="sr-only"> — {statusLabel[status]}</span>}
          {status === "expiring" && <span className="packet-flag">expiring this year</span>}
          {status === "expired" && <span className="packet-flag">expired</span>}
        </p>
        <dl className="packet-meta">
          <div>
            <dt>Packed</dt>
            <dd>{p.packetYear}</dd>
          </div>
          <div>
            <dt>Quantity</dt>
            <dd>{QUANTITY_LABELS[p.quantity]}</dd>
          </div>
        </dl>
        {p.notes && (
          <p className="packet-notes" title={p.notes}>
            {p.notes}
          </p>
        )}
        <div className="packet-actions">
          <button type="button" className="btn btn-ghost" onClick={() => onEdit(p)}>
            Edit
          </button>
          <button type="button" className="btn btn-ghost btn-danger" onClick={() => onDelete(p)}>
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const year = useMemo(currentYear, []);
  const initial = useMemo(() => loadPackets(localStorage), []);
  const [packets, setPackets] = useState<SeedPacket[]>(initial.packets);
  const [warning, setWarning] = useState<string | null>(
    initial.corrupt ? "Some saved vault data was unreadable and has been discarded. Saving now will overwrite the old data." : null,
  );
  const [filter, setFilter] = useState<Source | "all">("all");
  const [sortDesc, setSortDesc] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SeedPacket | null>(null);
  const [form, setForm] = useState<FormInput>(() => emptyForm(year));
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!savePackets(localStorage, packets)) {
      setWarning("Could not save to this browser. Storage may be full or blocked — changes are kept only for this session.");
    }
  }, [packets]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (formOpen && !d.open) {
      d.showModal();
      firstFieldRef.current?.focus();
    } else if (!formOpen && d.open) {
      d.close();
    }
  }, [formOpen]);

  const stats = useMemo(() => computeStats(packets, year), [packets, year]);
  const filtered = filter === "all" ? packets : packets.filter((p) => p.source === filter);
  const visible = useMemo(() => sortPackets(filtered, sortDesc), [filtered, sortDesc]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm(year));
    setErrors({});
    setFormOpen(true);
  };
  const openEdit = (p: SeedPacket) => {
    setEditing(p);
    setForm({
      name: p.name,
      source: p.source,
      packetYear: String(p.packetYear),
      expirationYear: String(p.expirationYear),
      quantity: p.quantity,
      notes: p.notes,
    });
    setErrors({});
    setFormOpen(true);
  };
  const closeForm = () => setFormOpen(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const packet: SeedPacket = {
      id: editing ? editing.id : newId(),
      name: form.name.trim(),
      source: form.source,
      packetYear: Number(form.packetYear),
      expirationYear: Number(form.expirationYear),
      quantity: form.quantity,
      notes: form.notes.trim(),
    };
    setPackets((prev) =>
      editing ? prev.map((p) => (p.id === editing.id ? packet : p)) : [...prev, packet],
    );
    closeForm();
  };

  const doDelete = (p: SeedPacket) => {
    if (confirmId === p.id) {
      setPackets((prev) => prev.filter((x) => x.id !== p.id));
      setConfirmId(null);
    } else {
      setConfirmId(p.id);
    }
  };

  const setField = <K extends keyof FormInput>(k: K, v: FormInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const yearErr = (k: "packetYear" | "expirationYear") =>
    errors[k] ? (
      <p className="field-error" id={`${k}-error`} role="alert">
        <WarningIcon /> {errors[k]}
      </p>
    ) : null;

  return (
    <>
      <header className="masthead">
        <p className="masthead-eyebrow">A home gardener&apos;s almanac</p>
        <div className="masthead-row">
          <h1>Seed Packet Vault</h1>
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            <PlusIcon /> Add Packet
          </button>
        </div>
      </header>

      {warning && (
        <p className="storage-warning" role="alert">
          <WarningIcon /> {warning}
        </p>
      )}

      <nav className="statsbar" aria-label="Vault statistics and source filter">
        <div className="stat" aria-live="polite">
          <span className="stat-num">{stats.total}</span>
          <span className="stat-label">Packets total</span>
        </div>
        <div className="stat" aria-live="polite">
          <span className="stat-num stat-warn">{stats.expiring}</span>
          <span className="stat-label">Expiring {year}</span>
        </div>
        <div className="stat" aria-live="polite">
          <span className="stat-num stat-danger">{stats.expired}</span>
          <span className="stat-label">Expired</span>
        </div>
        <div className="stat-filters" role="group" aria-label="Filter by seed source">
          <span className="stat-label">Filter by source</span>
          <div className="chips">
            <button
              type="button"
              className={`chip ${filter === "all" ? "is-active" : ""}`}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All {stats.total}
            </button>
            {SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip ${filter === s ? "is-active" : ""}`}
                aria-pressed={filter === s}
                onClick={() => setFilter(s)}
              >
                {SOURCE_LABELS[s]} {stats.bySource[s]}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {packets.length > 0 && (
        <div className="toolbar">
          <p className="toolbar-count" aria-live="polite">
            Showing {visible.length} of {packets.length} packets
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSortDesc((d) => !d)}
            aria-label={`Sorted by expiration year, ${sortDesc ? "latest first" : "soonest first"}. Toggle order.`}
          >
            <SortIcon /> Sort: {sortDesc ? "latest first" : "soonest first"}
          </button>
        </div>
      )}

      <main className="grid-wrap">
        {packets.length === 0 ? (
          <div className="empty empty-vault">
            <SproutIcon />
            <h2>The vault is empty</h2>
            <p>File your first packet to begin the almanac.</p>
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              <PlusIcon /> Add Packet
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <MagnifierIcon />
            <h2>No packets match this source</h2>
            <p>
              Showing {visible.length} of {packets.length} packets.
            </p>
            <button type="button" className="btn btn-ghost" onClick={() => setFilter("all")}>
              Show all sources
            </button>
          </div>
        ) : (
          <ul className="grid">
            {visible.map((p) => (
              <li key={p.id}>
                <PacketCard p={p} year={year} onEdit={openEdit} onDelete={doDelete} />
                {confirmId === p.id && (
                  <div className="confirm-row" role="alertdialog" aria-label={`Confirm delete ${p.name}`}>
                    <span>Delete “{p.name}” permanently?</span>
                    <button type="button" className="btn btn-danger-solid" onClick={() => doDelete(p)}>
                      Yes, delete
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmId(null)}>
                      Keep
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="foot">
        <p>Kept in this browser only — no account, no server. Tend your stash, then sow.</p>
      </footer>

      <dialog
        ref={dialogRef}
        className="form-dialog"
        aria-labelledby="form-title"
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={submit} noValidate>
          <header className="dialog-band">
            <h2 id="form-title">{editing ? "Amend packet" : "File new packet"}</h2>
            <button type="button" className="btn btn-ghost btn-close" onClick={closeForm} aria-label="Close form">
              <CloseIcon />
            </button>
          </header>
          <div className="dialog-body">
            <div className="field">
              <label htmlFor="f-name">Plant name</label>
              <input
                ref={firstFieldRef}
                id="f-name"
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Cherry Tomato – Sun Gold"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
                maxLength={120}
              />
              {errors.name && (
                <p className="field-error" id="name-error" role="alert">
                  <WarningIcon /> {errors.name}
                </p>
              )}
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="f-source">Seed source</label>
                <select
                  id="f-source"
                  value={form.source}
                  onChange={(e) => setField("source", e.target.value as Source)}
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-quantity">Quantity remaining</label>
                <select
                  id="f-quantity"
                  value={form.quantity}
                  onChange={(e) => setField("quantity", e.target.value as Quantity)}
                >
                  {QUANTITIES.map((q) => (
                    <option key={q} value={q}>
                      {QUANTITY_LABELS[q]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="f-packet-year">Packet year</label>
                <input
                  id="f-packet-year"
                  type="number"
                  inputMode="numeric"
                  value={form.packetYear}
                  onChange={(e) => setField("packetYear", e.target.value)}
                  min={1900}
                  max={2100}
                  aria-invalid={!!errors.packetYear}
                  aria-describedby={errors.packetYear ? "packetYear-error" : undefined}
                />
                {yearErr("packetYear")}
              </div>
              <div className="field">
                <label htmlFor="f-exp-year">Expiration year</label>
                <input
                  id="f-exp-year"
                  type="number"
                  inputMode="numeric"
                  value={form.expirationYear}
                  onChange={(e) => setField("expirationYear", e.target.value)}
                  min={1900}
                  max={2100}
                  aria-invalid={!!errors.expirationYear}
                  aria-describedby={errors.expirationYear ? "expirationYear-error" : undefined}
                />
                {yearErr("expirationYear")}
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-notes">Notes</label>
              <textarea
                id="f-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="great germination last spring, needs soaking overnight…"
                maxLength={1000}
              />
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editing ? "Save changes" : "Add to vault"}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 2v12M2 8h12" />
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3l10 10M13 3L3 13" />
  </svg>
);
const WarningIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="currentColor">
    <path d="M8 1l7 13H1L8 1zm-.9 5h1.8v4.2H7.1V6zm0 5.4h1.8v1.8H7.1v-1.8z" />
  </svg>
);
const SortIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 4h10M5 8h6M7 12h2" />
  </svg>
);
const SproutIcon = () => (
  <svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M24 40V22" />
    <path d="M24 22c0-8-6-12-14-12 0 8 6 12 14 12z" />
    <path d="M24 26c0-6 4-9 11-9 0 6-4 9-11 9z" />
    <path d="M14 40h20" strokeDasharray="3 3" />
  </svg>
);
const MagnifierIcon = () => (
  <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="20" cy="20" r="11" />
    <path d="M28 28l10 10" />
    <path d="M15 20h10M20 15v10" strokeDasharray="2.5 2.5" />
  </svg>
);
