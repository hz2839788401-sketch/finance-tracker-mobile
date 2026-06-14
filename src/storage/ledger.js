import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  addTransactionToRows,
  importCsvRowsToTransactions,
  sortTransactions,
  updateTransactionInRows
} from "../core/ledgerCore";

const STORAGE_KEY = "financeTracker.transactions.v1";
const FALLBACK_KEY = "financeTracker.transactions.fallback.v1";
const CHUNK_SIZE = 1800;

export async function loadTransactions() {
  let raw = await loadSecurePayload(STORAGE_KEY);
  if (!raw) raw = await AsyncStorage.getItem(FALLBACK_KEY);
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? sortTransactions(rows) : [];
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
  const result = addTransactionToRows(existing, input);
  if (result.added) await saveTransactions(result.rows);
  return result.added;
}

export async function updateTransaction(id, patch) {
  const existing = await loadTransactions();
  await saveTransactions(updateTransactionInRows(existing, id, patch));
}

export async function importCsvRows(rows) {
  const existing = await loadTransactions();
  const result = importCsvRowsToTransactions(existing, rows);
  await saveTransactions(result.rows);
  return result.imported;
}
