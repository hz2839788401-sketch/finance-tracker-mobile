import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "financeTracker.transactions.v1";
const FALLBACK_KEY = "financeTracker.transactions.fallback.v1";
const CHUNK_SIZE = 1800;

function stableFingerprint(item) {
  return [item.sourceApp, item.amount, item.direction, item.merchant, item.rawText].join("|").toLowerCase();
}

function createId() {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function loadTransactions() {
  let raw = await loadSecurePayload(STORAGE_KEY);
  if (!raw) raw = await AsyncStorage.getItem(FALLBACK_KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    return Array.isArray(rows)
      ? rows.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      : [];
  } catch {
    return [];
  }
}

async function saveTransactions(rows) {
  const payload = JSON.stringify(rows);
  if (await saveSecurePayload(STORAGE_KEY, payload)) {
    await AsyncStorage.removeItem(FALLBACK_KEY);
    return;
  }
  await AsyncStorage.setItem(FALLBACK_KEY, payload);
}

async function loadSecurePayload(key) {
  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) return "";
    const manifestRaw = await SecureStore.getItemAsync(`${key}.manifest`);
    if (!manifestRaw) return await SecureStore.getItemAsync(key);
    const manifest = JSON.parse(manifestRaw);
    const chunks = [];
    for (let index = 0; index < manifest.count; index += 1) {
      chunks.push((await SecureStore.getItemAsync(`${key}.${index}`)) || "");
    }
    return chunks.join("");
  } catch {
    return "";
  }
}

async function saveSecurePayload(key, payload) {
  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) return false;
    const count = Math.ceil(payload.length / CHUNK_SIZE);
    for (let index = 0; index < count; index += 1) {
      await SecureStore.setItemAsync(`${key}.${index}`, payload.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      });
    }
    await SecureStore.setItemAsync(`${key}.manifest`, JSON.stringify({ count }), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
    await SecureStore.setItemAsync(key, "", {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
    return true;
  } catch {
    return false;
  }
}

export async function addTransaction(input) {
  const existing = await loadTransactions();
  const next = {
    id: input.id || createId(),
    source: input.source || "manual",
    sourceApp: input.sourceApp || "manual",
    amount: Number(input.amount || 0),
    direction: input.direction || "expense",
    merchant: input.merchant || "未命名",
    category: input.category || "other",
    accountHint: input.accountHint || "",
    occurredAt: input.occurredAt || new Date().toISOString(),
    rawText: input.rawText || "",
    confidence: Number(input.confidence ?? 1),
    status: input.status || "pending"
  };
  const fingerprint = stableFingerprint(next);
  if (existing.some((item) => stableFingerprint(item) === fingerprint)) {
    return false;
  }
  await saveTransactions([next, ...existing]);
  return true;
}

export async function updateTransaction(id, patch) {
  const existing = await loadTransactions();
  await saveTransactions(existing.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

export async function importCsvRows(rows) {
  let count = 0;
  for (const row of rows) {
    const added = await addTransaction({
      source: "import",
      sourceApp: row.sourceApp || row.source || "import",
      amount: row.amount,
      direction: row.direction || "expense",
      merchant: row.merchant || row.payee || row.description || "导入记录",
      category: row.category || "other",
      accountHint: row.accountHint || row.account || "",
      occurredAt: row.occurredAt || row.date || new Date().toISOString(),
      rawText: row.rawText || row.description || "",
      confidence: 1,
      status: row.status || "confirmed"
    });
    if (added) count += 1;
  }
  return count;
}
