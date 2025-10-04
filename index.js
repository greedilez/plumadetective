import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const KEITARO_URL = "https://origin.plumadetective.help/plumadetective-Policy";

app.get("/", async (req, res) => {
  try {
    const response = await fetch(KEITARO_URL, {
      redirect: "follow",
      headers: {
        "User-Agent": req.headers["user-agent"] || "",
        "Accept-Language": req.headers["accept-language"] || "en-US,en;q=0.9",
        "X-Forwarded-For": req.ip,
      },
    });

    if (response.url !== KEITARO_URL) {
      return res.json({
        image_url: "",
        offer_url: response.url,
      });
    }

    const html = await response.text();
    let imageUrl = "";

    const imgIndex = html.indexOf("<img");
    if (imgIndex !== -1) {
      const srcIndex = html.indexOf("src=", imgIndex);
      if (srcIndex !== -1) {
        const startQuote = html[srcIndex + 4];
        const endQuote = html.indexOf(startQuote, srcIndex + 5);
        imageUrl = html.substring(srcIndex + 5, endQuote).trim();
      }
    }

    res.json({
      image_url: imageUrl || "",
      offer_url: "",
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to fetch Keitaro URL" });
  }
});

app.listen(PORT, () => {
  console.log("API running on port", PORT);
});
