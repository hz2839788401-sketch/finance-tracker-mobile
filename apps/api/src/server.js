const express = require("express");
const cors = require("cors");
const {
  clearTransactions,
  deleteTransaction,
  getStorageInfo,
  listTransactions,
  loginUser,
  registerUser,
  requireSession,
  updateTransaction,
  upsertTransaction
} = require("./db");
const { parseNotificationText } = require("../../../src/parsers/notificationParser");

const app = express();
const port = Number(process.env.PORT || 4010);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function handleError(res, error) {
  if (error.code === "bad_request") return res.status(400).json({ error: error.message });
  if (error.code === "conflict") return res.status(409).json({ error: error.message });
  if (error.code === "unauthorized") return res.status(401).json({ error: error.message });
  console.error(error);
  return res.status(500).json({ error: "server_error" });
}

function authenticated(req, res, next) {
  try {
    req.context = requireSession(req.headers.authorization);
    next();
  } catch (error) {
    handleError(res, error);
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, storage: getStorageInfo() });
});

app.post("/api/auth/register", (req, res) => {
  try {
    res.status(201).json(registerUser(req.body?.username, req.body?.password));
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    res.json(loginUser(req.body?.username, req.body?.password));
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/api/auth/me", authenticated, (req, res) => {
  res.json({ user: { id: req.context.user.id, username: req.context.user.username, createdAt: req.context.user.createdAt } });
});

app.get("/api/transactions", authenticated, (req, res) => {
  res.json({ transactions: listTransactions(req.context, { status: req.query.status, query: req.query.query }) });
});

app.post("/api/transactions", authenticated, (req, res) => {
  const result = upsertTransaction(req.context, req.body || {});
  res.status(result.added ? 201 : 200).json(result);
});

app.patch("/api/transactions/:id", authenticated, (req, res) => {
  const transaction = updateTransaction(req.context, req.params.id, req.body || {});
  if (!transaction) return res.status(404).json({ error: "not_found" });
  res.json({ transaction });
});

app.delete("/api/transactions/:id", authenticated, (req, res) => {
  res.json({ deleted: deleteTransaction(req.context, req.params.id) });
});

app.post("/api/debug/parse-notification", (req, res) => {
  const parsed = parseNotificationText(req.body?.text || "");
  res.json({ parsed });
});

app.post("/api/debug/inject-notification", authenticated, (req, res) => {
  const parsed = parseNotificationText(req.body?.text || "");
  const result = upsertTransaction(req.context, { ...parsed, status: "pending" });
  res.status(result.added ? 201 : 200).json({ parsed, ...result });
});

app.post("/api/debug/reset", authenticated, (req, res) => {
  clearTransactions(req.context);
  res.json({ ok: true });
});

if (require.main === module) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Finance Tracker API listening on http://localhost:${port}`);
    console.log(`Encrypted JSON ledgers: ${getStorageInfo().ledgerDir}`);
  });
}

module.exports = { app };
