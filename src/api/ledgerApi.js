const DEFAULT_API_BASE_URL = "http://127.0.0.1:4010";

let apiBaseUrl = DEFAULT_API_BASE_URL;
let authToken = "";

function setApiBaseUrl(url) {
  apiBaseUrl = String(url || "").replace(/\/$/, "") || DEFAULT_API_BASE_URL;
}

function setAuthToken(token) {
  authToken = String(token || "");
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `API ${response.status} ${path}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function health() {
  return requestJson("/health");
}

async function register(username, password) {
  return requestJson("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

async function login(username, password) {
  return requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

async function me() {
  return requestJson("/api/auth/me");
}

async function listTransactions({ status, query } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (query) params.set("query", query);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await requestJson(`/api/transactions${suffix}`);
  return data.transactions || [];
}

async function addTransaction(transaction) {
  const data = await requestJson("/api/transactions", {
    method: "POST",
    body: JSON.stringify(transaction)
  });
  return Boolean(data.added);
}

async function updateTransaction(id, patch) {
  const data = await requestJson(`/api/transactions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
  return data.transaction;
}

async function injectNotification(text) {
  return requestJson("/api/debug/inject-notification", {
    method: "POST",
    body: JSON.stringify({ text })
  });
}

module.exports = {
  addTransaction,
  health,
  injectNotification,
  listTransactions,
  login,
  me,
  register,
  setApiBaseUrl,
  setAuthToken,
  updateTransaction
};
