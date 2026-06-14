const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { app } = require("../src/server");

function request(port, method, requestPath, body, token = "") {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body), "utf8") : Buffer.alloc(0);
    const req = http.request(
      {
        port,
        method,
        path: requestPath,
        hostname: "127.0.0.1",
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-length": data.length,
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {} });
        });
      }
    );
    req.on("error", reject);
    if (data.length > 0) req.write(data);
    req.end();
  });
}

const server = app.listen(0, "127.0.0.1", async () => {
  const port = server.address().port;
  try {
    const blocked = await request(port, "GET", "/api/transactions");
    assert.strictEqual(blocked.status, 401);

    const username = `smoke_${Date.now()}`;
    const registered = await request(port, "POST", "/api/auth/register", {
      username,
      password: "local123"
    });
    assert.strictEqual(registered.status, 201);
    assert.strictEqual(registered.body.user.username, username);
    assert.ok(registered.body.token);

    const token = registered.body.token;
    await request(port, "POST", "/api/debug/reset", undefined, token);
    const injected = await request(
      port,
      "POST",
      "/api/debug/inject-notification",
      { text: "微信支付：你已向星巴克支付18.00元" },
      token
    );
    assert.strictEqual(injected.status, 201);
    assert.strictEqual(injected.body.transaction.amount, 18);
    assert.strictEqual(injected.body.transaction.sourceApp, "wechat");
    assert.strictEqual(injected.body.transaction.merchant, "星巴克");

    const duplicate = await request(
      port,
      "POST",
      "/api/debug/inject-notification",
      { text: "微信支付：你已向星巴克支付18.00元" },
      token
    );
    assert.strictEqual(duplicate.status, 200);
    assert.strictEqual(duplicate.body.added, false);

    const list = await request(port, "GET", "/api/transactions?status=pending", undefined, token);
    assert.strictEqual(list.body.transactions.length, 1);

    const id = list.body.transactions[0].id;
    const patched = await request(port, "PATCH", `/api/transactions/${id}`, { status: "confirmed" }, token);
    assert.strictEqual(patched.body.transaction.status, "confirmed");

    const ledgerPath = path.resolve(__dirname, "../data/ledgers", `${registered.body.user.id}.ledger.enc.json`);
    const rawLedger = fs.readFileSync(ledgerPath, "utf8");
    assert.strictEqual(rawLedger.includes("星巴克"), false);
    assert.strictEqual(rawLedger.includes("微信支付"), false);
    assert.strictEqual(rawLedger.includes("ciphertext"), true);

    console.log("api smoke tests passed");
  } finally {
    server.close();
  }
});
