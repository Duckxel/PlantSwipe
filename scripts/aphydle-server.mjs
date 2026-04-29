#!/usr/bin/env node
// Static file server for Aphydle's built dist/ directory.
// Mirrors plant-swipe-node.service runtime pattern: `/usr/bin/node <file>`.
// Listens on 127.0.0.1; nginx terminates TLS and reverse-proxies.
//
// Env:
//   APHYDLE_PORT  default 4173
//   APHYDLE_HOST  default 127.0.0.1
//   APHYDLE_DIST  default /var/www/Aphydle/dist

import http from "node:http";
import { join, normalize, extname } from "node:path";
import { existsSync, statSync, createReadStream } from "node:fs";

const PORT = parseInt(process.env.APHYDLE_PORT || "4173", 10);
const HOST = process.env.APHYDLE_HOST || "127.0.0.1";
const DIST = normalize(process.env.APHYDLE_DIST || "/var/www/Aphydle/dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".eot":  "application/vnd.ms-fontobject",
  ".map":  "application/json; charset=utf-8",
  ".txt":  "text/plain; charset=utf-8",
  ".xml":  "application/xml; charset=utf-8",
};

function resolveFile(reqUrl) {
  let pathname = "/";
  try {
    pathname = new URL(reqUrl, "http://localhost").pathname;
  } catch {
    return null;
  }
  let p = decodeURIComponent(pathname);
  if (p.endsWith("/")) p += "index.html";
  const abs = normalize(join(DIST, p));
  // Path traversal guard: must stay under DIST
  if (abs !== DIST && !abs.startsWith(DIST + "/")) return null;
  return abs;
}

const server = http.createServer((req, res) => {
  let abs = resolveFile(req.url);
  if (!abs) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  let stat = existsSync(abs) ? statSync(abs) : null;

  // Directory → promote to its index.html. Required so vite-emitted
  // extensionless permalinks like /puzzle/<n>/ also serve correctly when
  // the client omits the trailing slash (e.g. typed URLs, sitemap entries
  // mirrored without the slash). Without this we'd fall through to
  // dist/index.html (the SPA shell) and lose the per-page canonical, OG,
  // JSON-LD, and breadcrumb metadata the puzzle archive relies on.
  if (stat?.isDirectory()) {
    const indexPath = join(abs, "index.html");
    if (existsSync(indexPath) && statSync(indexPath).isFile()) {
      abs = indexPath;
      stat = statSync(abs);
    }
  }

  if (!stat?.isFile()) {
    // SPA fallback: paths without an extension fall back to index.html
    const reqPath = (() => {
      try { return new URL(req.url, "http://x").pathname; } catch { return "/"; }
    })();
    if (/\.[a-z0-9]+$/i.test(reqPath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }
    abs = join(DIST, "index.html");
    if (!existsSync(abs)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Aphydle bundle not built — dist/index.html is missing");
      return;
    }
  }

  const ext = extname(abs).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const isHtml = ext === ".html";
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": isHtml
      ? "no-cache, no-store, must-revalidate"
      : "public, max-age=604800",
  });
  createReadStream(abs).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`[aphydle] serving ${DIST} on http://${HOST}:${PORT}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[aphydle] received ${sig}, shutting down`);
    server.close(() => process.exit(0));
  });
}
