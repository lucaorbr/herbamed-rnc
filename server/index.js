const http = require("http");

const PORT = Number(process.env.PORT || 9028);

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Payload muito grande"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleClaude(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return sendJson(res, 503, { error: "ANTHROPIC_API_KEY nao configurada" });

  try {
    const body = JSON.parse(await readBody(req) || "{}");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        ...body,
      }),
    });

    const data = await response.json();
    return sendJson(res, response.ok ? 200 : response.status, data);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") return sendJson(res, 200, { status: "ok", service: "backend" });
  if (req.url.startsWith("/api/claude")) return handleClaude(req, res);
  return sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`SGQ Herbamed backend ouvindo na porta ${PORT}`);
});
