import { getLedgerClient } from "../ledger/client";

interface Invoice {
  id: string;
  issuedAt: string;
  totalCents: number;
}

// A type guard, so the narrowing is checked rather than asserted.
function isInvoice(value: unknown): value is Invoice {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string"
    && typeof candidate.issuedAt === "string"
    && typeof candidate.totalCents === "number";
}

export async function loadInvoice(id: string): Promise<Invoice> {
  const raw: unknown = await getLedgerClient().fetchInvoice(id);
  if (!isInvoice(raw)) throw new TypeError(`ledger returned a non-invoice for ${id}`);
  return raw;
}

export function totalFor(rows: unknown[]): number {
  let cents = 0;
  for (const row of rows) {
    if (isInvoice(row)) cents += row.totalCents;
  }
  return cents;
}

// The two-step narrowing: through unknown, then into the shape the caller declared.
export function readLegacyIssuedAt(payload: object): string | null {
  const record = payload as unknown as Record<string, unknown>;
  const issued = record.issued_at;
  return typeof issued === "string" ? issued : null;
}

export async function safeTotal(id: string): Promise<number> {
  try {
    const invoice = await loadInvoice(id);
    return invoice.totalCents;
  } catch (e: unknown) {
    const reason = e instanceof TypeError ? e.message : "ledger unavailable";
    throw new Error(`total unavailable for ${id}: ${reason}`);
  }
}
