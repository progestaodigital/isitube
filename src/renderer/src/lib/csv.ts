/**
 * Minimal CSV builder. Defaults to semicolon separator + UTF-8 BOM so the
 * file opens cleanly in Brazilian Portuguese Excel locale (which uses `;`
 * by convention and needs the BOM to detect UTF-8).
 */

export type CsvCell = string | number | boolean | null | undefined;

export interface CsvOptions {
  separator?: string;
  withBom?: boolean;
  newline?: string;
}

export function toCsv(
  headers: string[],
  rows: CsvCell[][],
  opts: CsvOptions = {}
): string {
  const sep = opts.separator ?? ';';
  const newline = opts.newline ?? '\r\n';
  const withBom = opts.withBom ?? true;

  const escape = (val: CsvCell): string => {
    if (val === null || val === undefined) return '';
    const s = typeof val === 'number' ? formatNumber(val) : String(val);
    // Quote when the cell contains the separator, quotes, or newlines.
    const needsQuote = s.includes(sep) || s.includes('"') || /[\r\n]/.test(s);
    return needsQuote ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const headerLine = headers.map(escape).join(sep);
  const bodyLines = rows.map((row) => row.map(escape).join(sep));
  const csv = [headerLine, ...bodyLines].join(newline) + newline;

  return withBom ? '﻿' + csv : csv;
}

/**
 * Numbers in Brazilian Excel use `,` as decimal separator. Since we already
 * use `;` as field separator, we can safely switch decimals to `,`.
 */
function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return String(n);
  return n.toString().replace('.', ',');
}

/**
 * Helper: format a date as a locale-friendly string (or empty if missing).
 */
export function csvDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR');
}

/**
 * Helper: build a sortable filename like `canais-2026-05-09.csv`
 */
export function csvFilename(prefix: string): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${prefix}-${stamp}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
