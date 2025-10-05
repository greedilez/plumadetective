import express from "express";
import fetch from "node-fetch"; // или global fetch в node18+
import crypto from "crypto";
import { URL } from "url";

const app = express();
app.set("trust proxy", true);

const KEITARO_URL = "https://origin.plumadetective.help/plumadetective-Policy";

function genReqId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto.randomBytes(16).toString("hex");
}

function normalizeIp(ip) {
  if (!ip) return "";
  return String(ip).replace(/^::ffff:/, "").trim();
}

function detectClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const first = String(xff).split(",")[0].trim();
    if (first) return normalizeIp(first);
  }
  if (req.ip) return normalizeIp(req.ip);
  return normalizeIp(req.socket && req.socket.remoteAddress);
}

// Hop-by-hop headers that must NOT be forwarded per RFC
const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailers", "transfer-encoding", "upgrade"
]);

app.get("/", async (req, res) => {
  try {
    const clientIp = detectClientIp(req) || "";
    const incomingXFF = req.headers["x-forwarded-for"] || "";
    const incomingParts = String(incomingXFF).split(",").map(s => s.trim()).filter(Boolean);
    const outgoingXFF = [clientIp, ...incomingParts.filter(ip => ip !== clientIp && ip !== "unknown")].filter(Boolean).join(", ");

    const reqId = req.headers["x-req-id"] || req.headers["x-request-id"] || req.headers["x-correlation-id"] || genReqId();
    const forwardedProto = req.headers["x-forwarded-proto"] || req.protocol || (req.secure ? "https" : "http");
    const forwardedHost = req.headers["x-forwarded-host"] || req.headers.host || "";

    // Собираем заголовки: копируем входящие, но убираем hop-by-hop и заменяем/добавляем нужные
    const outgoingHeaders = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const key = k.toLowerCase();
      if (HOP_BY_HOP.has(key)) continue;
      // не форвардим host — установим хост целевого сервера или оставим X-Forwarded-Host
      if (key === "host") continue;
      outgoingHeaders[key] = v;
    }

    // Принудительные заголовки (браузерные/проксируемые)
    outgoingHeaders["user-agent"] = req.headers["user-agent"] || outgoingHeaders["user-agent"] || "";
    outgoingHeaders["accept"] = req.headers["accept"] || outgoingHeaders["accept"] || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
    outgoingHeaders["accept-language"] = req.headers["accept-language"] || outgoingHeaders["accept-language"] || "en-US,en;q=0.9";
    // Если хочешь, прокинь accept-encoding, но учти: node-fetch может сам работать с gzip/br
    if (req.headers["accept-encoding"]) outgoingHeaders["accept-encoding"] = req.headers["accept-encoding"];

    outgoingHeaders["referer"] = req.headers["referer"] || outgoingHeaders["referer"] || "";
    outgoingHeaders["upgrade-insecure-requests"] = req.headers["upgrade-insecure-requests"] || "1";
    // sec-* заголовки если есть — прокинем
    ["sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-user", "sec-fetch-dest"]
      .forEach(h => { if (req.headers[h]) outgoingHeaders[h] = req.headers[h]; });

    // Cookies
    if (req.headers.cookie) outgoingHeaders["cookie"] = req.headers.cookie;

    // Наши proxy headers
    outgoingHeaders["x-forwarded-for"] = outgoingXFF;
    outgoingHeaders["x-real-ip"] = clientIp;
    outgoingHeaders["x-forwarded-proto"] = forwardedProto;
    outgoingHeaders["x-forwarded-host"] = forwardedHost;
    outgoingHeaders["x-req-id"] = reqId;

    // Установим Host целевого сервера (иногда Keitaro проверяет Host)
    const tgt = new URL(KEITARO_URL);
    outgoingHeaders["host"] = tgt.host;

    // Выполняем запрос
    const response = await fetch(KEITARO_URL, {
      method: "GET",
      redirect: "follow",
      headers: outgoingHeaders,
    });

    // Передаём клиенту любые Set-Cookie из ответа (если нужно)
    const setCookie = response.headers.raw && response.headers.raw()["set-cookie"];
    if (Array.isArray(setCookie)) {
      setCookie.forEach(c => res.append("Set-Cookie", c));
    }

    const body = await response.text();

    // Анализируешь body как раньше
    let imageUrl = "";
    const imgIndex = body.indexOf("<img");
    if (imgIndex !== -1) {
      const srcIndex = body.indexOf("src=", imgIndex);
      if (srcIndex !== -1) {
        const startQuote = body[srcIndex + 4];
        const endQuote = body.indexOf(startQuote, srcIndex + 5);
        imageUrl = body.substring(srcIndex + 5, endQuote).trim();
      }
    }

    res.json({ image_url: imageUrl || "", offer_url: response.url !== KEITARO_URL ? response.url : "" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "proxy error" });
  }
});

app.listen(process.env.PORT || 3000);
