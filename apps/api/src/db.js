const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const dataDir = path.resolve(__dirname, "../data");
const legacyDbPath = path.join(dataDir, "finance-tracker.json");
const usersPath = path.join(dataDir, "users.json");
const ledgerDir = path.join(dataDir, "ledgers");
const PBKDF2_ITERATIONS = 210000;
const KEY_BYTES = 32;

fs.mkdirSync(ledgerDir, { recursive: true });

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function readUsers() {
  const data = readJson(usersPath, { users: [] });
  return { users: Array.isArray(data.users) ? data.users : [] };
}

function writeUsers(state) {
  writeJson(usersPath, state);
}

function safeUserId(username) {
  return crypto.createHash("sha256").update(username).digest("hex").slice(0, 24);
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password || ""), salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256").toString("base64");
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function deriveLedgerKey(password, salt) {
  return crypto.pbkdf2Sync(String(password || ""), salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");
}

function ledgerPathFor(userId) {
  return path.join(ledgerDir, `${userId}.ledger.enc.json`);
}

function encryptLedger(state, password, encryptionSalt) {
  const iv = crypto.randomBytes(12);
  const key = deriveLedgerKey(password, encryptionSalt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: encrypted.toString("base64")
  };
}

function decryptLedger(payload, password, encryptionSalt) {
  const key = deriveLedgerKey(password, encryptionSalt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final()
  ]);
  const parsed = JSON.parse(decrypted.toString("utf8"));
  return { transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [] };
}

function decryptPayload(payload, password, encryptionSalt) {
  const key = deriveLedgerKey(password, encryptionSalt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function readUserLedger(user, password) {
  const filePath = ledgerPathFor(user.id);
  if (!fs.existsSync(filePath)) return { transactions: [] };
  const payload = readJson(filePath, null);
  if (!payload) return { transactions: [] };
  return decryptLedger(payload, password, user.encryptionSalt);
}

function writeUserLedger(user, password, state) {
  const payload = encryptLedger(
    { transactions: Array.isArray(state.transactions) ? state.transactions : [] },
    password,
    user.encryptionSalt
  );
  writeJson(ledgerPathFor(user.id), payload);
}

function createSession(user, password) {
  const secret = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 14;
  const sessionSalt = crypto.randomBytes(16).toString("base64");
  const passwordEnvelope = encryptLedger({ password }, secret, sessionSalt);
  return {
    id: crypto.randomUUID(),
    secret,
    token: crypto.randomBytes(32).toString("base64url"),
    tokenHash: crypto.createHash("sha256").update(`${user.id}:${secret}`).digest("base64"),
    sessionSalt,
    passwordEnvelope,
    expiresAt
  };
}

function readSessionPassword(user, session) {
  const secret = session.secret;
  const decrypted = decryptPayload(session.passwordEnvelope, secret, session.sessionSalt);
  return decrypted.password || "";
}

function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

function registerUser(usernameInput, password) {
  const username = normalizeUsername(usernameInput);
  if (username.length < 2) throw Object.assign(new Error("用户名至少 2 个字符"), { code: "bad_request" });
  if (String(password || "").length < 6) throw Object.assign(new Error("密码至少 6 个字符"), { code: "bad_request" });

  const state = readUsers();
  if (state.users.some((item) => item.username === username)) {
    throw Object.assign(new Error("用户已存在"), { code: "conflict" });
  }

  const now = new Date().toISOString();
  const passwordSalt = crypto.randomBytes(16).toString("base64");
  const encryptionSalt = crypto.randomBytes(16).toString("base64");
  const user = {
    id: safeUserId(username),
    username,
    passwordSalt,
    passwordHash: hashPassword(password, passwordSalt),
    encryptionSalt,
    sessions: [],
    createdAt: now
  };
  const session = createSession(user, password);
  user.sessions.push({ ...session, secret: undefined });
  state.users.push(user);
  writeUsers(state);
  writeUserLedger(user, password, { transactions: [] });

  return { user: publicUser(user), token: `${user.id}.${session.token}.${session.id}.${session.secret}` };
}

function loginUser(usernameInput, password) {
  const username = normalizeUsername(usernameInput);
  const state = readUsers();
  const user = state.users.find((item) => item.username === username);
  if (!user || !timingSafeEqualText(user.passwordHash, hashPassword(password, user.passwordSalt))) {
    throw Object.assign(new Error("用户名或密码错误"), { code: "unauthorized" });
  }

  const session = createSession(user, password);
  user.sessions = (user.sessions || []).filter((item) => item.expiresAt > Date.now()).slice(-4);
  user.sessions.push({ ...session, secret: undefined });
  writeUsers(state);
  return { user: publicUser(user), token: `${user.id}.${session.token}.${session.id}.${session.secret}` };
}

function requireSession(authHeader) {
  const raw = String(authHeader || "").replace(/^Bearer\s+/i, "");
  const [userId, token, sessionId, secret] = raw.split(".");
  if (!userId || !token || !sessionId || !secret) {
    throw Object.assign(new Error("未登录"), { code: "unauthorized" });
  }
  const state = readUsers();
  const user = state.users.find((item) => item.id === userId);
  const session = user?.sessions?.find((item) => item.id === sessionId && item.token === token);
  if (!user || !session || session.expiresAt <= Date.now()) {
    throw Object.assign(new Error("登录已过期"), { code: "unauthorized" });
  }
  const tokenHash = crypto.createHash("sha256").update(`${user.id}:${secret}`).digest("base64");
  if (!timingSafeEqualText(tokenHash, session.tokenHash)) {
    throw Object.assign(new Error("登录已过期"), { code: "unauthorized" });
  }
  return { user, password: readSessionPassword(user, { ...session, secret }) };
}

function fingerprintFor(item) {
  return [item.sourceApp, item.amount, item.direction, item.merchant, item.rawText].join("|").toLowerCase();
}

function sortTransactions(rows) {
  return [...rows].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

function listTransactions(context, { status, query } = {}) {
  const normalized = String(query || "").trim().toLowerCase();
  return sortTransactions(
    readUserLedger(context.user, context.password).transactions.filter((item) => {
      if (status && item.status !== status) return false;
      if (!normalized) return true;
      return [item.merchant, item.category, item.accountHint, item.rawText, item.sourceApp]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    })
  );
}

function upsertTransaction(context, input) {
  const state = readUserLedger(context.user, context.password);
  const now = new Date().toISOString();
  const item = {
    id: input.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    source: input.source || "manual",
    sourceApp: input.sourceApp || "manual",
    amount: Number(input.amount || 0),
    direction: input.direction || "expense",
    merchant: input.merchant || "未命名",
    category: input.category || "other",
    accountHint: input.accountHint || "",
    occurredAt: input.occurredAt || now,
    rawText: input.rawText || "",
    confidence: Number(input.confidence ?? 1),
    status: input.status || "pending"
  };
  const fingerprint = fingerprintFor(item);
  const existing = state.transactions.find((row) => fingerprintFor(row) === fingerprint);
  if (existing) return { transaction: existing, added: false };

  state.transactions = sortTransactions([item, ...state.transactions]);
  writeUserLedger(context.user, context.password, state);
  return { transaction: item, added: true };
}

function updateTransaction(context, id, patch) {
  const state = readUserLedger(context.user, context.password);
  let updated = null;
  state.transactions = state.transactions.map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, ...patch };
    return updated;
  });
  writeUserLedger(context.user, context.password, state);
  return updated;
}

function deleteTransaction(context, id) {
  const state = readUserLedger(context.user, context.password);
  const before = state.transactions.length;
  state.transactions = state.transactions.filter((item) => item.id !== id);
  writeUserLedger(context.user, context.password, state);
  return state.transactions.length !== before;
}

function clearTransactions(context) {
  writeUserLedger(context.user, context.password, { transactions: [] });
}

function getStorageInfo() {
  return {
    usersPath,
    ledgerDir,
    legacyDbPath,
    encrypted: true,
    algorithm: "aes-256-gcm"
  };
}

module.exports = {
  clearTransactions,
  deleteTransaction,
  getStorageInfo,
  legacyDbPath,
  listTransactions,
  loginUser,
  registerUser,
  requireSession,
  updateTransaction,
  upsertTransaction
};
