const http = require("http");

function request(method, requestPath, body, token = "") {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body), "utf8") : Buffer.alloc(0);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 4010,
        method,
        path: requestPath,
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
        res.on("end", () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {} }));
      }
    );
    req.on("error", reject);
    if (data.length > 0) req.write(data);
    req.end();
  });
}

async function ensureUser() {
  const username = "local";
  const password = "local123";
  const registered = await request("POST", "/api/auth/register", { username, password });
  if (registered.status === 201) return registered.body;
  const loggedIn = await request("POST", "/api/auth/login", { username, password });
  if (loggedIn.status !== 200) throw new Error(JSON.stringify(loggedIn.body));
  return loggedIn.body;
}

async function main() {
  const session = await ensureUser();
  const token = session.token;
  await request("POST", "/api/debug/reset", undefined, token);
  await request("POST", "/api/debug/inject-notification", { text: "微信支付：你已向星巴克支付18.00元" }, token);
  await request("POST", "/api/debug/inject-notification", { text: "支付宝到账提醒：收到张三转账200.00元" }, token);
  const data = await request("GET", "/api/transactions", undefined, token);
  console.log(JSON.stringify({ user: session.user, ...data.body }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
