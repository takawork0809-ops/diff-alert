// Amazon商品ページから商品名を取得する(ベストエフォート)。
// ボット検知やタイムアウトで取れない場合は null を返し、登録自体は続行する。
export async function fetchAmazonTitle(asin: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.amazon.co.jp/dp/${asin}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ja-JP,ja;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.includes("validateCaptcha")) return null;

    const m = html.match(/id="productTitle"[^>]*>\s*([\s\S]*?)\s*<\/span>/);
    let title = m?.[1];
    if (!title) {
      const t = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1];
      if (t) {
        title = t
          .replace(/^Amazon(\.co\.jp)?\s*[:：|｜]\s*/, "")
          .replace(/\s*[:：|｜][^:：|｜]*(オンライン通販|通販)$/, "");
      }
    }
    if (!title) return null;
    title = decodeEntities(title).replace(/\s+/g, " ").trim();
    if (!title || title === "ページが見つかりません") return null;
    return title.slice(0, 200);
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
