// 楽天市場商品検索API(2026-07-01版)を、サーバー側から呼び出す。
// アプリIDとアクセスキーは、サーバー側の環境変数だけに置き、画面やブラウザには出さない。
//   RAKUTEN_APPLICATION_ID, RAKUTEN_ACCESS_KEY, (任意) RAKUTEN_REFERER

const ENDPOINT = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";

export type RakutenCandidate = {
  itemCode: string;
  name: string;
  price: number;
  url: string;
  shopName: string;
  imageUrl: string | null;
  inStock: boolean;
  pointRate: number | null;
};

export type RakutenSearchResult =
  | { ok: true; items: RakutenCandidate[]; total: number }
  | { ok: false; reason: "not_configured" | "rate_limited" | "forbidden" | "error"; message: string };

export function rakutenConfigured(): boolean {
  return !!(process.env.RAKUTEN_APPLICATION_ID && process.env.RAKUTEN_ACCESS_KEY);
}

type RawItem = Record<string, unknown>;

function toCandidate(raw: RawItem): RakutenCandidate | null {
  const e = (raw.Item ?? raw) as RawItem; // formatVersion によって、Item で包まれている場合がある
  const name = typeof e.itemName === "string" ? e.itemName : null;
  const url = typeof e.itemUrl === "string" ? e.itemUrl : null;
  const price = Number(e.itemPrice);
  if (!name || !url || !Number.isFinite(price)) return null;

  const images = e.mediumImageUrls;
  let imageUrl: string | null = null;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    imageUrl = typeof first === "string" ? first : typeof (first as RawItem)?.imageUrl === "string" ? ((first as RawItem).imageUrl as string) : null;
  }
  const pointRate = Number(e.pointRate);
  return {
    itemCode: String(e.itemCode ?? ""),
    name,
    price,
    url,
    shopName: typeof e.shopName === "string" ? e.shopName : "",
    imageUrl,
    inStock: Number(e.availability) !== 0,
    pointRate: Number.isFinite(pointRate) && pointRate > 1 ? pointRate : null,
  };
}

export async function searchRakutenItems(keyword: string, sort: "standard" | "+itemPrice" = "standard"): Promise<RakutenSearchResult> {
  const applicationId = process.env.RAKUTEN_APPLICATION_ID;
  const accessKey = process.env.RAKUTEN_ACCESS_KEY;
  if (!applicationId || !accessKey) {
    return { ok: false, reason: "not_configured", message: "楽天の検索は、準備中です。" };
  }
  const kw = keyword.trim().slice(0, 128);
  if (!kw) return { ok: true, items: [], total: 0 };

  const params = new URLSearchParams({
    applicationId,
    keyword: kw,
    hits: "30",
    sort,
    formatVersion: "2",
    availability: "1", // 在庫のあるものだけ
    elements: "itemName,itemCode,itemPrice,itemUrl,shopName,mediumImageUrls,availability,pointRate",
  });

  const referer = process.env.RAKUTEN_REFERER || "https://sagakuradar.com/";

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: {
        accessKey,
        // 2026年から、アプリに登録したサイトが、リクエスト元として確認される。
        // Referer だけでは 403(REFERRER_MISSING)になり、Origin も必要(実際のAPIで確認済み)。
        Referer: referer,
        Origin: new URL(referer).origin,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 300 }, // 同じ検索を、5分間は、再利用する
    });
    if (res.status === 404) return { ok: true, items: [], total: 0 }; // 該当なし
    if (res.status === 429) return { ok: false, reason: "rate_limited", message: "検索が混み合っています。しばらくしてから、もう一度お試しください。" };
    if (res.status === 401 || res.status === 403) {
      console.error("rakuten api forbidden", res.status);
      return { ok: false, reason: "forbidden", message: "楽天の検索の設定に問題があります。運営者に、お問い合わせください。" };
    }
    if (!res.ok) {
      console.error("rakuten api error", res.status);
      return { ok: false, reason: "error", message: "楽天の検索に失敗しました。しばらくしてから、もう一度お試しください。" };
    }
    const data = (await res.json()) as { count?: number; Items?: RawItem[]; items?: RawItem[] };
    const list = data.Items ?? data.items ?? [];
    const items = list.map(toCandidate).filter((c): c is RakutenCandidate => c !== null);
    return { ok: true, items, total: Number(data.count ?? items.length) };
  } catch (e) {
    console.error("rakuten api exception", e);
    return { ok: false, reason: "error", message: "楽天の検索に失敗しました。しばらくしてから、もう一度お試しください。" };
  }
}
