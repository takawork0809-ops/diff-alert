import LegalLayout from "@/components/LegalLayout";
import { LEGAL } from "@/lib/legal";
import { PLANS, yen } from "@/lib/plans";

export const metadata = { title: "特定商取引法に基づく表記 | 差益レーダー" };

const rows: [string, React.ReactNode][] = [
  ["販売事業者", LEGAL.operator],
  ["運営責任者", "請求があった場合、遅滞なく開示いたします。"],
  ["所在地", "請求があった場合、遅滞なく開示いたします。"],
  ["電話番号", "請求があった場合、遅滞なく開示いたします。お問い合わせは、下記のメールアドレスにお願いします。"],
  ["メールアドレス", LEGAL.email],
  [
    "販売価格",
    <ul key="price" className="space-y-1">
      <li>{PLANS.free.name}: {yen(PLANS.free.price)}(監視 {PLANS.free.limit} 商品まで)</li>
      <li>{PLANS.standard.name}: 月額 {yen(PLANS.standard.price)}(税込)(監視 {PLANS.standard.limit} 商品まで)</li>
      <li>{PLANS.pro.name}: 月額 {yen(PLANS.pro.price)}(税込)(監視 {PLANS.pro.limit} 商品まで)</li>
    </ul>,
  ],
  ["商品代金以外の必要料金", "なし。ただし、本サービスの利用にかかるインターネット接続料金や通信料金は、お客様のご負担となります。"],
  ["お支払い方法", "クレジットカード(決済代行: Stripe, Inc.)"],
  [
    "お支払い時期",
    "有料プランは、お申し込み時に初回の料金をお支払いいただきます。以降は、毎月、お申し込みと同じ日に、自動で更新され、請求されます。",
  ],
  ["サービスの提供時期", "お支払いの完了後、直ちにご利用いただけます。"],
  [
    "解約について",
    "解約は、ログイン後の「プラン」画面の「お支払いの管理」から、いつでも行えます。解約後も、お支払い済みの期間の終わりまで、有料プランをご利用いただけます。次回の更新日までに解約の手続きをされなかった場合、次の期間の料金が請求されます。",
  ],
  [
    "返金・キャンセル",
    "デジタルサービスの性質上、お支払い済みの料金は、原則として返金いたしません。ただし、当方の責めに帰すべき事由により、サービスを提供できなかった場合は、個別に対応いたします。",
  ],
  ["動作環境", "最新の主要なウェブブラウザ(Chrome、Safari、Edge など)と、メールを受信できる環境が必要です。"],
  ["表現・サービスに関する注意", "本サービスが表示する価格や利益の計算は参考情報であり、利益や成果を保証するものではありません。詳しくは、利用規約をご確認ください。"],
];

export default function TokushohoPage() {
  return (
    <LegalLayout title="特定商取引法に基づく表記" updated={LEGAL.updated}>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left">
          <tbody className="divide-y divide-white/10">
            {rows.map(([label, value]) => (
              <tr key={label} className="align-top">
                <th className="w-32 bg-navy-800/50 px-4 py-3 text-xs font-bold text-slate-300 sm:w-48">{label}</th>
                <td className="px-4 py-3">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LegalLayout>
  );
}
