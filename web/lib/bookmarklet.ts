// (外部への依存を持たない。移動先のURLは、呼び出し側から渡す。)
// Amazon.co.jp の商品ページで押すと、ASIN・商品名・(あれば)JANを読み取って、差益レーダーの検索ページを開く。
// 読み取るのは、いま開いているページの表示内容だけ。ログイン情報やクッキーには触れず、外部へ送信もしない。
export function buildBookmarkletCode(siteUrl: string): string {
  const code = `(function(){
var h=location.hostname;
var m=location.pathname.match(/\\/(?:dp|gp\\/product|gp\\/aw\\/d)\\/([A-Za-z0-9]{10})/);
if(!/(^|\\.)amazon\\.co\\.jp$/.test(h)||!m){alert('Amazon.co.jp の商品ページで押してください。');return;}
var t=(document.getElementById('productTitle')||{}).innerText||document.title||'';
var jan='';
try{var rows=document.querySelectorAll('tr');for(var i=0;i<rows.length;i++){var th=rows[i].querySelector('th'),td=rows[i].querySelector('td');if(th&&td&&/JAN|EAN|GTIN/i.test(th.innerText)){var d=(td.innerText.match(/[0-9]{8,14}/)||[])[0];if(d){jan=d;break;}}}}catch(e){}
var u='${siteUrl}/dashboard/find?asin='+m[1].toUpperCase()+'&title='+encodeURIComponent(t.replace(/\\s+/g,' ').trim().slice(0,200))+(jan?'&jan='+jan:'');
if(!window.open(u,'_blank')){location.href=u;}
})();`;
  return code.replace(/\n/g, "");
}

export function buildBookmarklet(siteUrl: string): string {
  return "javascript:" + buildBookmarkletCode(siteUrl);
}
