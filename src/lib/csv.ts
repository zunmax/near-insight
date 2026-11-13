/** One CSV field: empty for null, quoted (RFC 4180) when it holds a quote, comma, semicolon (the separator in some spreadsheet
    locales) or line break. Text that starts like a spreadsheet formula gets a leading apostrophe, so a spreadsheet shows it
    as text instead of running it; numbers, negative ones included, are written as they are. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value);
  return /[",;\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** CSV lines of a query result: a header of `columns`, then each row's values in that order. */
export function csvLines(columns: string[], rows: Iterable<Record<string, unknown>>): string[] {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
  return lines;
}
