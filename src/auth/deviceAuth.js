import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const ACCOUNT_KEY = "financeTracker.deviceAccount.v1";
const SESSION_KEY = "financeTracker.deviceSession.v1";
const SESSION_FALLBACK_KEY = "financeTracker.deviceSession.fallback.v1";
const DEVICE_TOKEN = "device-local-session";
const CHUNK_SIZE = 1800;

function hashPassword(password, salt) {
  const input = `${salt}:${String(password || "")}`;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return `dev_${Math.abs(hash).toString(36)}_${input.length}`;
}

function makeSalt() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readSecureJson(key, fallbackKey) {
  let raw = await readSecurePayload(key);
  if (!raw && fallbackKey) raw = await AsyncStorage.getItem(fallbackKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeSecureJson(key, fallbackKey, value) {
  const payload = JSON.stringify(value);
  if (await writeSecurePayload(key, payload)) {
    if (fallbackKey) await AsyncStorage.removeItem(fallbackKey);
    return;
  }
  if (fallbackKey) await AsyncStorage.setItem(fallbackKey, payload);
}

async function readSecurePayload(key) {
  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) return "";
    const manifestRaw = await SecureStore.getItemAsync(`${key}.manifest`);
    if (!manifestRaw) return (await SecureStore.getItemAsync(key)) || "";
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

async function writeSecurePayload(key, payload) {
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

export async function hasDeviceAccount() {
  const account = await readSecureJson(ACCOUNT_KEY, `${ACCOUNT_KEY}.fallback`);
  return Boolean(account?.passwordHash && account?.salt);
}

export async function getDeviceAccountMeta() {
  const account = await readSecureJson(ACCOUNT_KEY, `${ACCOUNT_KEY}.fallback`);
  if (!account?.username) return null;
  return { username: account.username, createdAt: account.createdAt || "" };
}

export async function registerDeviceAccount(username, password) {
  const name = String(username || "").trim() || "本机账本";
  if (String(password || "").length < 6) {
    throw new Error("密码至少 6 位");
  }
  if (await hasDeviceAccount()) {
    throw new Error("本机账号已存在，请直接解锁");
  }
  const salt = makeSalt();
  const account = {
    username: name,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString()
  };
  await writeSecureJson(ACCOUNT_KEY, `${ACCOUNT_KEY}.fallback`, account);
  return createDeviceSession(account);
}

export async function unlockDeviceAccount(password) {
  const account = await readSecureJson(ACCOUNT_KEY, `${ACCOUNT_KEY}.fallback`);
  if (!account?.passwordHash) {
    throw new Error("请先创建本机账号");
  }
  if (account.passwordHash !== hashPassword(password, account.salt)) {
    throw new Error("密码不正确");
  }
  return createDeviceSession(account);
}

async function createDeviceSession(account) {
  const session = {
    token: DEVICE_TOKEN,
    user: { username: account.username, id: "device-local", createdAt: account.createdAt },
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30
  };
  await writeSecureJson(SESSION_KEY, SESSION_FALLBACK_KEY, session);
  return session;
}

export async function loadDeviceSession() {
  const session = await readSecureJson(SESSION_KEY, SESSION_FALLBACK_KEY);
  if (!session?.token || !session?.user) return null;
  if (session.expiresAt && session.expiresAt <= Date.now()) {
    await clearDeviceSession();
    return null;
  }
  return session;
}

export async function clearDeviceSession() {
  try {
    const available = await SecureStore.isAvailableAsync();
    if (available) {
      const manifestRaw = await SecureStore.getItemAsync(`${SESSION_KEY}.manifest`);
      if (manifestRaw) {
        const manifest = JSON.parse(manifestRaw);
        for (let index = 0; index < manifest.count; index += 1) {
          await SecureStore.deleteItemAsync(`${SESSION_KEY}.${index}`);
        }
        await SecureStore.deleteItemAsync(`${SESSION_KEY}.manifest`);
      }
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  } catch {
    // Ignore secure-store cleanup errors.
  }
  await AsyncStorage.removeItem(SESSION_FALLBACK_KEY);
}

export { DEVICE_TOKEN };
