const assert = require("assert");
const { parseNotificationText } = require("../src/parsers/notificationParser");

const cases = [
  {
    text: "微信支付：你已向星巴克支付18.00元",
    expected: { sourceApp: "wechat", amount: 18, direction: "expense", category: "food" }
  },
  {
    text: "支付宝到账提醒：收到张三转账200.00元",
    expected: { sourceApp: "alipay", amount: 200, direction: "income", category: "transfer" }
  },
  {
    text: "招商银行信用卡尾号1234消费人民币86.50元，商户美团",
    expected: { sourceApp: "bank", amount: 86.5, direction: "expense", accountHint: "尾号 1234" }
  },
  {
    text: "证券交易提醒：买入沪深300ETF 1000.00元，成交成功",
    expected: { sourceApp: "broker", amount: 1000, direction: "expense", category: "investment" }
  },
  {
    text: "支付宝退款通知：退款35.80元已到账",
    expected: { sourceApp: "alipay", amount: 35.8, direction: "refund" }
  }
];

for (const item of cases) {
  const actual = parseNotificationText(item.text);
  for (const [key, value] of Object.entries(item.expected)) {
    assert.strictEqual(actual[key], value, `${item.text} expected ${key}=${value}, got ${actual[key]}`);
  }
}

console.log(`parser tests passed: ${cases.length}`);
