export function escapeCsvCell(value) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (/[,"\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function toCsv(headers, rows) {
  const head = headers.map((header) => escapeCsvCell(header.label)).join(",");
  const body = rows
    .map((row) =>
      headers.map((header) => escapeCsvCell(row[header.key])).join(","),
    )
    .join("\n");
  return `${head}\n${body}`;
}

export function parseCsv(csvText) {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  if (!text.trim()) return [];

  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((cell) => String(cell || "").trim());
  return rows
    .slice(1)
    .filter((cells) => cells.some((c) => String(c || "").trim()))
    .map((cells) => {
      const out = {};
      headers.forEach((header, index) => {
        out[header] = String(cells[index] || "").trim();
      });
      return out;
    });
}
