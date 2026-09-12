export function visibleWidth(text: string): number {
  return text.replace(/\u001b\[[0-9;]*m/g, "").length;
}

export function padVisible(text: string, width: number): string {
  const pad = Math.max(0, width - visibleWidth(text));
  return `${text}${" ".repeat(pad)}`;
}

export function truncate(text: string, max: number): string {
  if (visibleWidth(text) <= max) return text;
  if (max <= 1) return "…";
  return `${text.replace(/\u001b\[[0-9;]*m/g, "").slice(0, Math.max(0, max - 1))}…`;
}

export function renderTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return `${headers.join("  ")}\n  (none)`;
  }

  const colCount = headers.length;
  const budget = Math.max(60, (process.stdout.columns ?? 100) - 4);
  const widths = headers.map((header, index) => {
    const longest = Math.max(header.length, ...rows.map((row) => visibleWidth(row[index] ?? "")));
    return Math.min(longest, index === colCount - 1 ? 80 : 36);
  });

  const total = widths.reduce((sum, width) => sum + width, 0) + (colCount - 1) * 3 + 4;
  if (total > budget && widths.length > 0) {
    const overflow = total - budget;
    widths[widths.length - 1] = Math.max(16, widths[widths.length - 1] - overflow);
  }

  const top = `┌${widths.map((width) => "─".repeat(width + 2)).join("┬")}┐`;
  const mid = `├${widths.map((width) => "─".repeat(width + 2)).join("┼")}┤`;
  const bottom = `└${widths.map((width) => "─".repeat(width + 2)).join("┴")}┘`;

  const formatRow = (cells: string[]): string => {
    const padded = cells.map((cell, index) => padVisible(truncate(cell ?? "", widths[index] ?? 0), widths[index] ?? 0));
    return `│ ${padded.join(" │ ")} │`;
  };

  return [top, formatRow(headers), mid, ...rows.map(formatRow), bottom].join("\n");
}
