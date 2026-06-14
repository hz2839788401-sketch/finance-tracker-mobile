import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import * as ledgerApi from "./src/api/ledgerApi";
import { categories, sampleNotifications } from "./src/data/constants";
import { computeStats, filterTransactions } from "./src/core/ledgerCore";
import { parseNotificationText } from "./src/parsers/notificationParser";
import { addTransaction, importCsvRows, loadTransactions, updateTransaction } from "./src/storage/ledger";
import { exportTransactionsCsv, parseCsv } from "./src/utils/csv";

const emptyDraft = {
  amount: "",
  direction: "expense",
  merchant: "",
  category: "other",
  accountHint: "",
  rawText: ""
};

export default function App() {
  const [auth, setAuth] = useState({ token: "", user: null });
  const [authDraft, setAuthDraft] = useState({ username: "local", password: "local123" });
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [tab, setTab] = useState("pending");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [manualOpen, setManualOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [importTextOpen, setImportTextOpen] = useState(false);
  const [billText, setBillText] = useState(sampleNotifications.join("\n"));
  const [debugText, setDebugText] = useState(sampleNotifications[0]);
  const [debugParsed, setDebugParsed] = useState(parseNotificationText(sampleNotifications[0]));
  const [dataSource, setDataSource] = useState("checking");

  useEffect(() => {
    const token = localStorageGet("financeTracker.apiToken");
    const userRaw = localStorageGet("financeTracker.apiUser");
    if (token) {
      ledgerApi.setAuthToken(token);
      setAuth({ token, user: userRaw ? JSON.parse(userRaw) : null });
    }
  }, []);

  useEffect(() => {
    if (auth.token) refresh();
  }, [auth.token]);

  async function refresh() {
    try {
      await ledgerApi.health();
      if (!auth.token) return;
      const rows = await ledgerApi.listTransactions();
      setTransactions(rows);
      setDataSource("api");
    } catch {
      const rows = await loadTransactions();
      setTransactions(rows);
      setDataSource("local");
    }
  }

  async function submitAuth() {
    setAuthError("");
    try {
      await ledgerApi.health();
      const result =
        authMode === "register"
          ? await ledgerApi.register(authDraft.username, authDraft.password)
          : await ledgerApi.login(authDraft.username, authDraft.password);
      ledgerApi.setAuthToken(result.token);
      localStorageSet("financeTracker.apiToken", result.token);
      localStorageSet("financeTracker.apiUser", JSON.stringify(result.user));
      setAuth({ token: result.token, user: result.user });
      setDataSource("api");
    } catch (error) {
      setAuthError(error.message || "登录失败");
    }
  }

  function logout() {
    ledgerApi.setAuthToken("");
    localStorageSet("financeTracker.apiToken", "");
    localStorageSet("financeTracker.apiUser", "");
    setAuth({ token: "", user: null });
    setTransactions([]);
    setDataSource("checking");
  }

  async function saveTransaction(payload) {
    if (dataSource === "api") return ledgerApi.addTransaction(payload);
    return addTransaction(payload);
  }

  async function patchTransaction(id, patch) {
    if (dataSource === "api") return ledgerApi.updateTransaction(id, patch);
    return updateTransaction(id, patch);
  }

  async function saveManual() {
    const amount = Number(String(draft.amount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("金额不正确", "请输入大于 0 的数字。");
      return;
    }

    await saveTransaction({
      source: "manual",
      sourceApp: "manual",
      amount,
      direction: draft.direction,
      merchant: draft.merchant.trim() || "手动记账",
      category: draft.category,
      accountHint: draft.accountHint.trim(),
      rawText: draft.rawText.trim(),
      confidence: 1,
      status: "confirmed",
      occurredAt: new Date().toISOString()
    });
    setDraft(emptyDraft);
    setManualOpen(false);
    refresh();
  }

  async function addParsedNotification(text) {
    const parsed = parseNotificationText(text);
    await saveTransaction({
      ...parsed,
      status: "pending",
      occurredAt: new Date().toISOString()
    });
    setTab("pending");
    refresh();
  }

  async function injectDebugNotification() {
    const parsed = parseNotificationText(debugText);
    setDebugParsed(parsed);
    await addParsedNotification(debugText);
  }

  async function syncNativeNotifications() {
    if (Platform.OS !== "android" || !NativeModules.FinanceNotificationModule) {
      Alert.alert("当前环境不可用", "通知监听只在安装到安卓手机后的原生 App 中可用。电脑前端请用调试台模拟通知。");
      return;
    }

    const rawItems = await NativeModules.FinanceNotificationModule.getPendingNotifications();
    const items = parseNativeNotifications(rawItems);
    for (const item of items) {
      const parsed = parseNotificationText(`${item.title || ""} ${item.text || ""}`);
      await saveTransaction({
        ...parsed,
        source: "notification",
        rawText: parsed.rawText || item.text || item.title || "",
        occurredAt: item.postedAt || new Date().toISOString(),
        status: "pending"
      });
    }
    await NativeModules.FinanceNotificationModule.clearPendingNotifications();
    setTab("pending");
    refresh();
  }

  async function openNotificationSettings() {
    if (Platform.OS !== "android" || !NativeModules.FinanceNotificationModule) {
      Alert.alert("当前环境不可用", "只有安卓安装包里才有通知权限入口。");
      return;
    }
    await NativeModules.FinanceNotificationModule.openNotificationListenerSettings();
  }

  async function setStatus(id, status) {
    await patchTransaction(id, { status });
    refresh();
  }

  async function importCsvFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel"],
      copyToCacheDirectory: true
    });
    if (result.canceled) return;

    const file = result.assets[0];
    const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
    const rows = parseCsv(content);

    let imported = 0;
    if (dataSource === "api") {
      for (const row of rows) {
        const added = await ledgerApi.addTransaction({
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
        if (added) imported += 1;
      }
    } else {
      imported = await importCsvRows(rows);
    }

    Alert.alert("导入完成", `已导入 ${imported} 条记录。`);
    refresh();
  }

  async function exportCsvFile() {
    const csv = exportTransactionsCsv(transactions.filter((item) => item.status === "confirmed"));
    if (Platform.OS === "web") {
      await Clipboard.setStringAsync(csv);
      Alert.alert("已复制", "CSV 已复制到剪贴板。");
      return;
    }

    const uri = `${FileSystem.cacheDirectory}finance-tracker-export.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "导出账本 CSV" });
    } else {
      await Clipboard.setStringAsync(csv);
      Alert.alert("已复制", "当前设备不支持分享文件，CSV 已复制到剪贴板。");
    }
  }

  async function importBillText() {
    const lines = billText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    let imported = 0;
    for (const line of lines) {
      const parsed = parseNotificationText(line);
      const added = await saveTransaction({
        ...parsed,
        source: "import",
        status: parsed.amount > 0 ? "pending" : "ignored",
        occurredAt: new Date().toISOString()
      });
      if (added) imported += 1;
    }
    setImportTextOpen(false);
    setTab("pending");
    Alert.alert("导入完成", `已处理 ${lines.length} 行，新增 ${imported} 条。`);
    refresh();
  }

  const filtered = useMemo(() => filterTransactions(transactions, tab, query), [transactions, tab, query]);
  const stats = useMemo(() => computeStats(transactions), [transactions]);

  if (!auth.token) {
    return (
      <SafeAreaView style={styles.safe}>
        <ExpoStatusBar style="dark" />
        <AuthScreen
          mode={authMode}
          setMode={setAuthMode}
          draft={authDraft}
          setDraft={setAuthDraft}
          error={authError}
          onSubmit={submitAuth}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="dark" />
      <View style={styles.container}>
        <Header
          stats={stats}
          pendingCount={transactions.filter((item) => item.status === "pending").length}
          dataSource={dataSource}
          user={auth.user}
          onRefresh={refresh}
          onLogout={logout}
        />

        <View style={styles.toolbar}>
          <IconButton icon="add" label="记一笔" onPress={() => setManualOpen(true)} />
          <IconButton icon="bug" label="调试台" onPress={() => setDebugOpen(true)} />
          <IconButton icon="notifications" label="同步通知" onPress={syncNativeNotifications} />
          <IconButton icon="settings" label="通知权限" onPress={openNotificationSettings} />
          <IconButton icon="download" label="导入" onPress={importCsvFile} />
          <IconButton icon="document-text" label="账单文本" onPress={() => setImportTextOpen(true)} />
          <IconButton icon="share-outline" label="导出" onPress={exportCsvFile} />
        </View>

        <View style={styles.tabs}>
          <TabButton current={tab} value="pending" label="待确认" onPress={setTab} />
          <TabButton current={tab} value="confirmed" label="账本" onPress={setTab} />
          <TabButton current={tab} value="ignored" label="忽略" onPress={setTab} />
        </View>

        <TextInput style={styles.search} placeholder="搜索商户、分类、账户、原始通知" value={query} onChangeText={setQuery} />

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState tab={tab} onSamplePress={addParsedNotification} />}
          renderItem={({ item }) => <TransactionItem item={item} onStatus={setStatus} />}
        />
      </View>

      <ManualEntryModal
        open={manualOpen}
        draft={draft}
        setDraft={setDraft}
        onClose={() => setManualOpen(false)}
        onSave={saveManual}
      />
      <DebugModal
        open={debugOpen}
        text={debugText}
        parsed={debugParsed}
        onTextChange={(text) => {
          setDebugText(text);
          setDebugParsed(parseNotificationText(text));
        }}
        onInject={injectDebugNotification}
        onClose={() => setDebugOpen(false)}
      />
      <BillTextModal
        open={importTextOpen}
        text={billText}
        onTextChange={setBillText}
        onImport={importBillText}
        onClose={() => setImportTextOpen(false)}
      />
    </SafeAreaView>
  );
}

function localStorageGet(key) {
  if (Platform.OS !== "web" || typeof window === "undefined") return "";
  return window.localStorage.getItem(key) || "";
}

function localStorageSet(key, value) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  if (value) window.localStorage.setItem(key, value);
  else window.localStorage.removeItem(key);
}

function parseNativeNotifications(rawItems) {
  if (Array.isArray(rawItems)) return rawItems;
  if (typeof rawItems !== "string") return [];
  try {
    const parsed = JSON.parse(rawItems);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function AuthScreen({ mode, setMode, draft, setDraft, error, onSubmit }) {
  return (
    <View style={styles.authWrap}>
      <View style={styles.authPanel}>
        <Text style={styles.kicker}>本地账号</Text>
        <Text style={styles.title}>Finance Tracker</Text>
        <Text style={styles.authNote}>账号只保存在这台电脑的本地 API 里，用来隔离并加密你的账本。</Text>
        <TextInput style={styles.input} placeholder="用户名" value={draft.username} onChangeText={(username) => setDraft((prev) => ({ ...prev, username }))} />
        <TextInput
          style={styles.input}
          placeholder="密码，至少 6 位"
          value={draft.password}
          secureTextEntry
          onChangeText={(password) => setDraft((prev) => ({ ...prev, password }))}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable style={styles.saveButton} onPress={onSubmit}>
          <Text style={styles.saveText}>{mode === "register" ? "注册并进入" : "登录"}</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => setMode(mode === "register" ? "login" : "register")}>
          <Text style={styles.linkText}>{mode === "register" ? "已有账号，去登录" : "没有账号，创建本地账号"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Header({ stats, pendingCount, dataSource, user, onRefresh, onLogout }) {
  const sourceLabel = dataSource === "api" ? "本地 API/JSON 数据库" : dataSource === "local" ? "设备本地存储" : "连接中";
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.kicker}>本地联调账本</Text>
        <Text style={styles.title}>Finance Tracker</Text>
        <Text style={styles.sourceText}>数据源：{sourceLabel}</Text>
        <Text style={styles.sourceText}>账号：{user?.username || "local"}</Text>
      </View>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>支出</Text>
        <Text style={styles.summaryValue}>¥{stats.expense.toFixed(2)}</Text>
        <Text style={styles.summaryLabel}>收入/退款 ¥{stats.income.toFixed(2)}</Text>
        <Text style={styles.pendingBadge}>{pendingCount} 待确认</Text>
        <Pressable style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshText}>刷新</Text>
        </Pressable>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>退出</Text>
        </Pressable>
      </View>
    </View>
  );
}

function IconButton({ icon, label, onPress }) {
  return (
    <Pressable style={styles.iconButton} onPress={onPress}>
      <Ionicons name={icon} size={18} color="#0f172a" />
      <Text style={styles.iconLabel}>{label}</Text>
    </Pressable>
  );
}

function TabButton({ current, value, label, onPress }) {
  const active = current === value;
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={() => onPress(value)}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({ tab, onSamplePress }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="receipt-outline" size={34} color="#64748b" />
      <Text style={styles.emptyTitle}>{tab === "pending" ? "还没有待确认流水" : "这里暂时没有记录"}</Text>
      {tab === "pending" ? (
        <View style={styles.sampleBox}>
          <Text style={styles.sampleTitle}>用模拟通知测试解析器</Text>
          {sampleNotifications.map((text) => (
            <Pressable key={text} style={styles.sampleButton} onPress={() => onSamplePress(text)}>
              <Text style={styles.sampleText}>{text}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TransactionItem({ item, onStatus }) {
  const directionColor = item.direction === "expense" ? "#dc2626" : "#059669";
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.merchant}>{item.merchant || "未识别商户"}</Text>
          <Text style={styles.meta}>
            {item.sourceApp} · {item.category} · {new Date(item.occurredAt).toLocaleString()}
          </Text>
        </View>
        <Text style={[styles.amount, { color: directionColor }]}>
          {item.direction === "expense" ? "-" : "+"}¥{Number(item.amount || 0).toFixed(2)}
        </Text>
      </View>
      <Text style={styles.rawText} numberOfLines={3}>
        {item.rawText || "无原始文本"}
      </Text>
      <View style={styles.cardActions}>
        {item.status !== "confirmed" ? (
          <Pressable style={styles.confirmButton} onPress={() => onStatus(item.id, "confirmed")}>
            <Text style={styles.confirmText}>确认入账</Text>
          </Pressable>
        ) : null}
        {item.status !== "ignored" ? (
          <Pressable style={styles.ghostButton} onPress={() => onStatus(item.id, "ignored")}>
            <Text style={styles.ghostText}>忽略</Text>
          </Pressable>
        ) : null}
        {item.status !== "pending" ? (
          <Pressable style={styles.ghostButton} onPress={() => onStatus(item.id, "pending")}>
            <Text style={styles.ghostText}>移回待确认</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ManualEntryModal({ open, draft, setDraft, onClose, onSave }) {
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>手动记一笔</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="#0f172a" />
            </Pressable>
          </View>
          <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="金额" value={draft.amount} onChangeText={(amount) => setDraft((prev) => ({ ...prev, amount }))} />
          <TextInput style={styles.input} placeholder="商户 / 对方" value={draft.merchant} onChangeText={(merchant) => setDraft((prev) => ({ ...prev, merchant }))} />
          <TextInput style={styles.input} placeholder="账户备注，例如 招行尾号 1234" value={draft.accountHint} onChangeText={(accountHint) => setDraft((prev) => ({ ...prev, accountHint }))} />
          <Text style={styles.fieldLabel}>方向</Text>
          <View style={styles.segmentRow}>
            {["expense", "income", "refund"].map((direction) => (
              <Pressable key={direction} style={[styles.segment, draft.direction === direction && styles.segmentActive]} onPress={() => setDraft((prev) => ({ ...prev, direction }))}>
                <Text style={[styles.segmentText, draft.direction === direction && styles.segmentTextActive]}>
                  {direction === "expense" ? "支出" : direction === "income" ? "收入" : "退款"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>分类</Text>
          <View style={styles.categoryGrid}>
            {categories.map((category) => (
              <Pressable key={category.id} style={[styles.categoryChip, draft.category === category.id && styles.categoryChipActive]} onPress={() => setDraft((prev) => ({ ...prev, category: category.id }))}>
                <Text style={[styles.categoryText, draft.category === category.id && styles.categoryTextActive]}>{category.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={[styles.input, styles.textArea]} placeholder="备注 / 原始通知文本" value={draft.rawText} multiline onChangeText={(rawText) => setDraft((prev) => ({ ...prev, rawText }))} />
          <Pressable style={styles.saveButton} onPress={onSave}>
            <Text style={styles.saveText}>保存</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function DebugModal({ open, text, parsed, onTextChange, onInject, onClose }) {
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>调试台</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="#0f172a" />
            </Pressable>
          </View>
          <Text style={styles.fieldLabel}>模拟通知文本</Text>
          <TextInput style={[styles.input, styles.textArea]} value={text} multiline onChangeText={onTextChange} />
          <Text style={styles.fieldLabel}>解析结果</Text>
          <View style={styles.debugJsonBox}>
            <Text style={styles.debugJson}>{JSON.stringify(parsed, null, 2)}</Text>
          </View>
          <Pressable style={styles.saveButton} onPress={onInject}>
            <Text style={styles.saveText}>注入到待确认流水</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function BillTextModal({ open, text, onTextChange, onImport, onClose }) {
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>导入历史账单文本</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="#0f172a" />
            </Pressable>
          </View>
          <Text style={styles.authNote}>每行一条支付、到账、银行卡或证券提醒。无法识别的行会进入忽略或低置信度记录，不会冒充官方后台同步。</Text>
          <TextInput style={[styles.input, styles.largeTextArea]} value={text} multiline onChangeText={onTextChange} />
          <Pressable style={styles.saveButton} onPress={onImport}>
            <Text style={styles.saveText}>解析并导入</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc", paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
  container: { flex: 1, paddingHorizontal: 16 },
  authWrap: { flex: 1, justifyContent: "center", padding: 18 },
  authPanel: { width: "100%", maxWidth: 420, alignSelf: "center", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 18 },
  authNote: { color: "#475569", fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 14 },
  errorText: { color: "#dc2626", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  linkButton: { alignItems: "center", paddingVertical: 12 },
  linkText: { color: "#2563eb", fontWeight: "800" },
  header: { paddingTop: 18, paddingBottom: 14, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  kicker: { color: "#2563eb", fontSize: 13, fontWeight: "700" },
  title: { color: "#0f172a", fontSize: 27, fontWeight: "800", marginTop: 2 },
  sourceText: { color: "#475569", fontSize: 13, marginTop: 4, fontWeight: "700" },
  summary: { alignItems: "flex-end", gap: 2 },
  summaryLabel: { color: "#64748b", fontSize: 12 },
  summaryValue: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  pendingBadge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: "700" },
  refreshButton: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#dcfce7" },
  refreshText: { color: "#166534", fontSize: 12, fontWeight: "800" },
  logoutButton: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#fee2e2" },
  logoutText: { color: "#991b1b", fontSize: 12, fontWeight: "800" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  iconButton: { minWidth: 72, height: 44, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  iconLabel: { color: "#0f172a", fontSize: 12, fontWeight: "700" },
  tabs: { flexDirection: "row", borderRadius: 8, backgroundColor: "#e2e8f0", padding: 4, marginBottom: 10 },
  tab: { flex: 1, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  tabActive: { backgroundColor: "#ffffff" },
  tabText: { color: "#475569", fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: "#0f172a" },
  search: { height: 42, borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 12, color: "#0f172a", marginBottom: 10 },
  list: { paddingBottom: 24, gap: 10 },
  card: { backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", padding: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  cardTitleWrap: { flex: 1 },
  merchant: { color: "#0f172a", fontSize: 16, fontWeight: "800" },
  meta: { color: "#64748b", fontSize: 12, marginTop: 3 },
  amount: { fontSize: 18, fontWeight: "900" },
  rawText: { color: "#334155", fontSize: 13, marginTop: 10, lineHeight: 18 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  confirmButton: { backgroundColor: "#2563eb", borderRadius: 7, paddingHorizontal: 12, paddingVertical: 8 },
  confirmText: { color: "#ffffff", fontWeight: "800" },
  ghostButton: { borderRadius: 7, borderWidth: 1, borderColor: "#cbd5e1", paddingHorizontal: 12, paddingVertical: 8 },
  ghostText: { color: "#334155", fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: { color: "#334155", fontSize: 16, fontWeight: "800", marginTop: 10 },
  sampleBox: { width: "100%", marginTop: 18, gap: 8 },
  sampleTitle: { color: "#475569", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  sampleButton: { borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", padding: 10 },
  sampleText: { color: "#0f172a", fontSize: 13, lineHeight: 18 },
  modalSafe: { flex: 1, backgroundColor: "#f8fafc" },
  modalBody: { padding: 16, paddingBottom: 32 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { color: "#0f172a", fontSize: 22, fontWeight: "900" },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  input: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 12, color: "#0f172a", marginBottom: 10 },
  textArea: { minHeight: 90, paddingTop: 12, textAlignVertical: "top" },
  largeTextArea: { minHeight: 220, paddingTop: 12, textAlignVertical: "top" },
  fieldLabel: { color: "#334155", fontSize: 13, fontWeight: "800", marginTop: 4, marginBottom: 8 },
  segmentRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  segment: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  segmentActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  segmentText: { color: "#334155", fontWeight: "800" },
  segmentTextActive: { color: "#ffffff" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  categoryChip: { borderRadius: 7, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", paddingHorizontal: 11, paddingVertical: 8 },
  categoryChipActive: { backgroundColor: "#dbeafe", borderColor: "#2563eb" },
  categoryText: { color: "#334155", fontWeight: "700" },
  categoryTextActive: { color: "#1d4ed8" },
  saveButton: { height: 48, borderRadius: 8, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", marginTop: 8 },
  saveText: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  debugJsonBox: { backgroundColor: "#0f172a", borderRadius: 8, padding: 12, marginBottom: 12 },
  debugJson: { color: "#e2e8f0", fontSize: 12, lineHeight: 17 }
});
