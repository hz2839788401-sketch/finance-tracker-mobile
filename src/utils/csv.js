const headers = [
  "id",
  "source",
  "sourceApp",
  "amount",
  "direction",
  "merchant",
  "category",
  "accountHint",
  "occurredAt",
  "rawText",
  "confidence",
  "status"
];

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export function exportTransactionsCsv(rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function parseCsv(content) {
  const lines = String(content || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const keys = splitCsvLine(lines[0]).map((key) => key.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return keys.reduce((acc, key, index) => {
      acc[key] = cells[index] || "";
      return acc;
    }, {});
  });
}
