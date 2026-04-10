/**
 * Shared CSV export utility for sidebar data groups.
 */

type CsvRow = Record<string, string | number | boolean | null | undefined>;

function escapeCell(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCsv<T extends CsvRow>(
  rows: T[],
  columns: { key: keyof T; header: string }[],
  filename: string,
): void {
  if (rows.length === 0) return;

  const header = columns.map(c => escapeCell(c.header)).join(',');
  const body = rows.map(row =>
    columns.map(c => escapeCell(row[c.key])).join(','),
  );

  const csv = [header, ...body].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
