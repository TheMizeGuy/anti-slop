import { getLedgerClient } from "../ledger/client";

interface Invoice {
  id: string;
  issuedAt: string;
  totalCents: number;
}

export async function loadInvoice(id: string): Promise<Invoice> {
  const raw = await getLedgerClient().fetchInvoice(id);
  return raw as any;
}

export function totalFor(rows: unknown[]): number {
  let cents = 0;
  for (const row of rows) {
    cents += (row as any).totalCents;
  }
  return cents;
}

export function issuedAfter(invoice: Invoice, cutoff: Date): boolean {
  const issued = new Date((invoice as any).issued_at ?? invoice.issuedAt);
  return issued > cutoff;
}
