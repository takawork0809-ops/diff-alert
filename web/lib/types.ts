export type Category = "electronics" | "game" | "apparel" | "other";

export const CATEGORY_LABELS: Record<Category, string> = {
  electronics: "家電・ガジェット (手数料8%)",
  game: "ゲーム (手数料8%)",
  apparel: "衣類・シューズ (手数料15%)",
  other: "その他 (手数料10%)",
};

export type MonitoredProduct = {
  id: string;
  user_id: string;
  asin: string;
  rakuten_url: string;
  category: Category;
  target_margin: number;
  product_name: string | null;
  last_amazon_price: number | null;
  last_rakuten_price: number | null;
  last_net_margin: number | null;
  last_checked_at: string | null;
  created_at: string;
};
