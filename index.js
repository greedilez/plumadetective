app.get("/", async (req, res) => {
  try {
    const response = await fetch(KEITARO_URL, {
      redirect: "follow",
      headers: {
        "User-Agent": req.headers["user-agent"] || "",
        "Accept-Language": req.headers["accept-language"] || "en-US,en;q=0.9",
        "X-Forwarded-For": req.ip, // проброс IP клиента
      },
    });

    // если редирект
    if (response.url !== KEITARO_URL) {
      return res.json({
        image_url: "",
        offer_url: response.url,
      });
    }

    // иначе ищем картинку
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
