import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для добавления заголовков CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // разрешаем все источники
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const KEITARO_URL = "https://origin.plumadetective.help/plumadetective-Policy";

app.get("/", async (req, res) => {
  try {
    const response = await fetch(KEITARO_URL, { redirect: "follow" });
    const html = await response.text();

    const baseUrl = new URL(response.url);
    let imageUrl = "";
    const landingSlug = "pluma-detective";

    const imgIndex = html.indexOf("<img");
    if (imgIndex !== -1) {
      const srcIndex = html.indexOf("src=", imgIndex);
      if (srcIndex !== -1) {
        const startQuote = html[srcIndex + 4];
        const endQuote = html.indexOf(startQuote, srcIndex + 5);
        let imgPath = html.substring(srcIndex + 5, endQuote).trim();

        let fullUrl = new URL(imgPath, baseUrl).href;

        if (!fullUrl.includes(`/lander/${landingSlug}/`)) {
          const parts = fullUrl.split("/lander/");
          if (parts.length === 2) {
            fullUrl = parts[0] + `/lander/${landingSlug}/` + parts[1].split("/").slice(1).join("/");
          } else {
            const origin = baseUrl.origin;
            const filename = fullUrl.split("/").pop() || "";
            fullUrl = `${origin}/lander/${landingSlug}/${filename}`;
          }
        }

        imageUrl = fullUrl;
      }
    }

    res.json({
      image_url: imageUrl || "",
      offer_url: imageUrl ? "" : response.url,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to fetch Keitaro URL" });
  }
});

app.listen(PORT, () => {
  console.log("API running on port", PORT);
});
