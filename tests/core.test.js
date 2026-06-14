const assert = require("assert");
const {
  addTransactionToRows,
  computeStats,
  filterTransactions,
  importCsvRowsToTransactions,
  updateTransactionInRows
} = require("../src/core/ledgerCore");
const { exportTransactionsCsv, parseCsv } = require("../src/utils/csv");

const fixedOptions = { now: Date.parse("2026-06-14T10:00:00.000Z"), random: 0.123456 };

let rows = [];
let result = addTransactionToRows(
  rows,
  {
    source: "manual",
    sourceApp: "manual",
    amount: 18,
    direction: "expense",
    merchant: "星巴克",
    category: "food",
    status: "confirmed",
    rawText: "手动早餐"
  },
  fixedOptions
);

assert.strictEqual(result.added, true);
rows = result.rows;
assert.strictEqual(rows.length, 1);

result = addTransactionToRows(rows, rows[0], fixedOptions);
assert.strictEqual(result.added, false);
assert.strictEqual(result.rows.length, 1);

rows = updateTransactionInRows(rows, rows[0].id, { status: "pending" });
assert.strictEqual(rows[0].status, "pending");

const imported = importCsvRowsToTransactions(rows, [
  {
    amount: "200.5",
    direction: "income",
    merchant: "工资",
    category: "salary",
    date: "2026-06-13T09:00:00.000Z"
  }
]);
rows = imported.rows;
assert.strictEqual(imported.imported, 1);
assert.strictEqual(rows.length, 2);

const salary = rows.find((item) => item.merchant === "工资");
rows = updateTransactionInRows(rows, salary.id, { status: "confirmed" });
const stats = computeStats(rows);
assert.strictEqual(stats.income, 200.5);
assert.strictEqual(stats.expense, 0);

const found = filterTransactions(rows, "confirmed", "工资");
assert.strictEqual(found.length, 1);

const csv = exportTransactionsCsv(rows);
const parsed = parseCsv(csv);
assert.strictEqual(parsed.length, 2);
assert.strictEqual(parsed.some((item) => item.merchant === "工资"), true);

console.log("core ledger tests passed");
