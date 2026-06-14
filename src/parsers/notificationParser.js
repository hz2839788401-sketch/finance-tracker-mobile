const UNKNOWN_MERCHANT = "未识别来源";

const sourceRules = [
  { sourceApp: "wechat", patterns: [/微信|WeChat/i] },
  { sourceApp: "alipay", patterns: [/支付宝|Alipay/i] },
  {
    sourceApp: "bank",
    patterns: [/银行|信用卡|储蓄卡|尾号|卡号|人民币|入账|扣款|消费/i]
  },
  {
    sourceApp: "broker",
    patterns: [/证券|券商|股票|基金|买入|卖出|成交|ETF/i]
  }
];

const categoryRules = [
  { category: "food", pattern: /餐饮|咖啡|奶茶|外卖|美团|饿了么|星巴克|麦当劳|肯德基/i },
  { category: "shopping", pattern: /淘宝|天猫|京东|拼多多|购物|超市|便利店/i },
  { category: "transport", pattern: /滴滴|地铁|公交|铁路|机票|加油|停车/i },
  { category: "housing", pattern: /房租|物业|水费|电费|燃气/i },
  { category: "investment", pattern: /证券|基金|股票|ETF|买入|卖出|成交/i },
  { category: "salary", pattern: /工资|薪资|奖金/i },
  { category: "transfer", pattern: /转账|收款|到账/i }
];

function detectSourceApp(text) {
  const rule = sourceRules.find((item) => item.patterns.some((pattern) => pattern.test(text)));
  return rule ? rule.sourceApp : "unknown";
}

function detectDirection(text) {
  if (/退款|退回|返还/i.test(text)) return "refund";
  if (/收入|收到|收款|到账|入账|卖出/i.test(text)) return "income";
  return "expense";
}

function detectCategory(text) {
  const rule = categoryRules.find((item) => item.pattern.test(text));
  return rule ? rule.category : "other";
}

function extractAmount(text) {
  const candidates = [
    /(?:人民币|RMB|CNY|￥|¥)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:元|CNY|RMB)/i,
    /(?:消费|支付|付款|转账|收款|到账|退款|买入|卖出|成交)[^\d]{0,12}([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i
  ];

  for (const pattern of candidates) {
    const match = text.match(pattern);
    if (match) return Number(match[1].replace(/,/g, ""));
  }
  return 0;
}

function extractAccountHint(text) {
  const match = text.match(/(?:尾号|末四位|卡号后四位)\s*([0-9]{3,4})/);
  return match ? `尾号 ${match[1]}` : "";
}

function extractMerchant(text) {
  const merchantPatterns = [
    /商户[:：]?\s*([^，。；;]+)/,
    /向([^，。；;]+?)支付/,
    /在([^，。；;]+?)消费/,
    /收到([^，。；;]+?)转账/,
    /转账给([^，。；;]+)/
  ];

  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }

  if (/证券|券商|股票|基金|ETF/i.test(text)) return "证券交易";
  if (/微信/i.test(text)) return "微信支付";
  if (/支付宝/i.test(text)) return "支付宝";
  if (/银行|信用卡|储蓄卡/i.test(text)) return "银行卡";
  return UNKNOWN_MERCHANT;
}

function confidenceFor(parsed) {
  let score = 0.25;
  if (parsed.sourceApp !== "unknown") score += 0.2;
  if (parsed.amount > 0) score += 0.3;
  if (parsed.merchant && parsed.merchant !== UNKNOWN_MERCHANT) score += 0.15;
  if (parsed.category !== "other") score += 0.1;
  return Math.min(1, Number(score.toFixed(2)));
}

function makeId(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `tx_${Date.now()}_${Math.abs(hash)}`;
}

function parseNotificationText(input) {
  const rawText = String(input || "").replace(/\s+/g, " ").trim();
  const parsed = {
    id: makeId(rawText),
    source: "notification",
    sourceApp: detectSourceApp(rawText),
    amount: extractAmount(rawText),
    direction: detectDirection(rawText),
    merchant: extractMerchant(rawText),
    category: detectCategory(rawText),
    accountHint: extractAccountHint(rawText),
    occurredAt: new Date().toISOString(),
    rawText,
    confidence: 0,
    status: "pending"
  };
  return {
    ...parsed,
    confidence: confidenceFor(parsed)
  };
}

const parserInternals = {
  detectSourceApp,
  detectDirection,
  detectCategory,
  extractAmount,
  extractAccountHint,
  extractMerchant
};

module.exports = {
  parseNotificationText,
  parserInternals
};
