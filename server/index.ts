import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchVerifiedMarkets, fetchWalletPositions, verifyExecutionMarket } from "./dreamdex.js";
import { parseExecutionGuardQuery } from "./execution-guard.js";
import { validateRpcRequest } from "./rpc-proxy.js";
import { parsePositionAccount } from "../shared/positions.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "http://localhost:4173";
const revision = process.env.APP_REVISION ?? "local";
const rpcUrl = "https://api.infra.testnet.somnia.network/";
const maxRpcBodyBytes = 64 * 1024;

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

function applyHeaders(headers: Record<string, string> = {}) {
  return {
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    ...headers,
  };
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, applyHeaders({ "Content-Type": "application/json" }));
    return res.end(JSON.stringify({ error: "Bad request" }));
  }

  if (req.url === "/api/rpc" && req.method === "POST") {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxRpcBodyBytes) {
        res.writeHead(413, applyHeaders({ "Content-Type": "application/json" }));
        return res.end(JSON.stringify({ error: "RPC request is too large." }));
      }
      chunks.push(chunk);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      res.writeHead(400, applyHeaders({ "Content-Type": "application/json" }));
      return res.end(JSON.stringify({ error: "Invalid JSON-RPC request." }));
    }
    const rpcRequest = validateRpcRequest(payload);
    if (!rpcRequest) {
      res.writeHead(403, applyHeaders({ "Content-Type": "application/json" }));
      return res.end(JSON.stringify({ error: "RPC method is not allowed." }));
    }

    try {
      const upstream = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcRequest),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await upstream.text();
      res.writeHead(upstream.ok ? 200 : 502, applyHeaders({
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      }));
      return res.end(upstream.ok ? body : JSON.stringify({ error: "Somnia RPC is temporarily unavailable." }));
    } catch {
      res.writeHead(502, applyHeaders({ "Content-Type": "application/json" }));
      return res.end(JSON.stringify({ error: "Somnia RPC is temporarily unavailable." }));
    }
  }

  if (req.method !== "GET") {
    res.writeHead(405, applyHeaders({ "Content-Type": "application/json" }));
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  if (req.url === "/api/health") {
    res.writeHead(200, applyHeaders({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    }));
    return res.end(JSON.stringify({ status: "ok", service: "branch", revision }));
  }

  if (req.url === "/api/markets") {
    try {
      const payload = await fetchVerifiedMarkets();
      res.writeHead(200, applyHeaders({
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": allowedOrigin,
      }));
      return res.end(JSON.stringify(payload));
    } catch {
      res.writeHead(502, applyHeaders({ "Content-Type": "application/json" }));
      return res.end(JSON.stringify({ error: "DreamDEX market verification is temporarily unavailable." }));
    }
  }

  if (req.url.startsWith("/api/execution-guard?") && req.method === "GET") {
    const query = parseExecutionGuardQuery(new URL(req.url, "http://branch.local"));
    if (!query) {
      res.writeHead(400, applyHeaders({ "Content-Type": "application/json" }));
      return res.end(JSON.stringify({ error: "Invalid execution verification request." }));
    }
    try {
      const payload = await verifyExecutionMarket(query.marketId as `0x${string}`, query.pool as `0x${string}`);
      res.writeHead(200, applyHeaders({ "Content-Type": "application/json", "Cache-Control": "no-store" }));
      return res.end(JSON.stringify(payload));
    } catch {
      res.writeHead(409, applyHeaders({ "Content-Type": "application/json" }));
      return res.end(JSON.stringify({ error: "The selected market generation could not be verified." }));
    }
  }

  if (req.url.startsWith("/api/positions?") && req.method === "GET") {
    const account = parsePositionAccount(new URL(req.url, "http://branch.local").searchParams.get("account"));
    if (!account) {
      res.writeHead(400, applyHeaders({ "Content-Type": "application/json" }));
      return res.end(JSON.stringify({ error: "A valid wallet address is required." }));
    }
    try {
      const payload = await Promise.race([
        fetchWalletPositions(account),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("positions timeout")), 20_000)),
      ]);
      res.writeHead(200, applyHeaders({ "Content-Type": "application/json", "Cache-Control": "no-store" }));
      return res.end(JSON.stringify(payload));
    } catch {
      res.writeHead(502, applyHeaders({ "Content-Type": "application/json" }));
      return res.end(JSON.stringify({ error: "DreamDEX positions are temporarily unavailable." }));
    }
  }

  const rawPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const safePath = normalize(rawPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(dist, safePath);
  if (!filePath.startsWith(dist)) {
    res.writeHead(400, applyHeaders());
    return res.end("Bad request");
  }

  try {
    if (!(await stat(filePath)).isFile()) throw new Error("not a file");
  } catch {
    filePath = join(dist, "index.html");
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, applyHeaders({ "Content-Type": mime[extname(filePath)] ?? "application/octet-stream" }));
    return res.end(body);
  } catch {
    res.writeHead(404, applyHeaders());
    return res.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Branch server listening on http://${host}:${port}`);
});
