function createTransactionId(now = Date.now(), random = Math.random()) {
  return `tx_${now}_${random.toString(36).slice(2, 9)}`;
}

function stableFingerprint(item) {
  return [item.sourceApp, item.amount, item.direction, item.merchant, item.rawText]
    .join("|")
    .toLowerCase();
}

function normalizeTransaction(input, options = {}) {
  return {
    id: input.id || createTransactionId(options.now, options.random),
    source: input.source || "manual",
    sourceApp: input.sourceApp || "manual",
    amount: Number(input.amount || 0),
    direction: input.direction || "expense",
    merchant: input.merchant || "未命名",
    category: input.category || "other",
    accountHint: input.accountHint || "",
    occurredAt: input.occurredAt || new Date(options.now || Date.now()).toISOString(),
    rawText: input.rawText || "",
    confidence: Number(input.confidence ?? 1),
    status: input.status || "pending"
  };
}

function sortTransactions(rows) {
  return [...rows].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

function addTransactionToRows(rows, input, options = {}) {
  const next = normalizeTransaction(input, options);
  const fingerprint = stableFingerprint(next);
  if (rows.some((item) => stableFingerprint(item) === fingerprint)) {
    return { rows: sortTransactions(rows), added: false, transaction: next };
  }
  return { rows: sortTransactions([next, ...rows]), added: true, transaction: next };
}

function updateTransactionInRows(rows, id, patch) {
  return sortTransactions(rows.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

function importCsvRowsToTransactions(existingRows, csvRows, options = {}) {
  let rows = existingRows;
  let imported = 0;
  for (const row of csvRows) {
    const result = addTransactionToRows(
      rows,
      {
        source: "import",
        sourceApp: row.sourceApp || row.source || "import",
        amount: row.amount,
        direction: row.direction || "expense",
        merchant: row.merchant || row.payee || row.description || "导入记录",
        category: row.category || "other",
        accountHint: row.accountHint || row.account || "",
        occurredAt: row.occurredAt || row.date || new Date(options.now || Date.now()).toISOString(),
        rawText: row.rawText || row.description || "",
        confidence: 1,
        status: row.status || "confirmed"
      },
      options
    );
    rows = result.rows;
    if (result.added) imported += 1;
  }
  return { rows, imported };
}

function computeStats(rows) {
  return rows
    .filter((item) => item.status === "confirmed")
    .reduce(
      (acc, item) => {
        if (item.direction === "income" || item.direction === "refund") acc.income += Number(item.amount || 0);
        else acc.expense += Number(item.amount || 0);
        return acc;
      },
      { income: 0, expense: 0 }
    );
}

function filterTransactions(rows, status, query = "") {
  const normalized = query.trim().toLowerCase();
  return rows
    .filter((item) => item.status === status)
    .filter((item) => {
      if (!normalized) return true;
      return [item.merchant, item.category, item.accountHint, item.rawText, item.sourceApp]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
}

module.exports = {
  addTransactionToRows,
  computeStats,
  createTransactionId,
  filterTransactions,
  importCsvRowsToTransactions,
  normalizeTransaction,
  stableFingerprint,
  sortTransactions,
  updateTransactionInRows
};
