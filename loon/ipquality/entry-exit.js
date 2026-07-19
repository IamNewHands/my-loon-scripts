/**
 * 入口落地查询 - 检测节点入口和出口 IP 信息
 * 
 * 参考: https://github.com/Moli-X/Tool
 * 数据源: ip-api.com
 * 
 * [Script]
 * generic script-path=https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/ipquality/entry-exit.js, tag=入口落地查询, timeout=10, img-url=globe.asia.australia.system, enable=true
 */

const params = typeof $environment !== "undefined" && $environment.params ? $environment.params : {};
const nodeName = params.node || "";

console.log(`入口落地查询 - 节点: ${nodeName || "未获取"}`);

if (!nodeName) {
  $done({ title: "入口落地查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">未获取到节点名称</p>' });
} else {
  const url = "http://ip-api.com/json/?fields=status,message,query,country,countryCode,city,isp,org,as,lat,lon,timezone";
  $httpClient.get({ url, node: nodeName, timeout: 8000 }, (error, response, data) => {
    if (error) {
      $done({ title: "入口落地查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">查询超时</p>' });
    } else {
      try {
        const info = JSON.parse(data);
        if (info.status !== "success") throw new Error(info.message || "查询失败");
        
        const asMatch = info.as ? info.as.match(/AS(\d+)/i) : null;
        const asn = asMatch ? asMatch[1] : "";
        const asOrg = info.as ? info.as.replace(/AS\d+\s*/i, "") : "";
        
        let html = `<div style="text-align:center;font-family:-apple-system;font-size:14px;line-height:1.8;padding:10px">`;
        html += `━━━━━━━━━━━━━━━━<br>`;
        html += `<b>远端 IP</b> : ${info.query}<br>`;
        html += `<b>地区</b> : ${info.country || ""} ${info.countryCode ? "⟦" + flagEmoji(info.countryCode) + "⟧" : ""}<br>`;
        html += `<b>城市</b> : ${info.city || "—"}<br>`;
        if (asn) html += `<b>ASN</b> : AS${asn}<br>`;
        if (asOrg) html += `<b>机构</b> : ${asOrg}<br>`;
        if (info.isp && info.isp !== asOrg) html += `<b>ISP</b> : ${info.isp}<br>`;
        if (info.lat && info.lon) html += `<b>坐标</b> : ${info.lat}, ${info.lon}<br>`;
        if (info.timezone) html += `<b>时区</b> : ${info.timezone}<br>`;
        html += `━━━━━━━━━━━━━━━━<br>`;
        html += `<font color=#6959CD><b>节点</b> ➟ ${nodeName}</font>`;
        html += `</div>`;
        
        $done({ title: "入口落地查询", htmlMessage: html });
      } catch(e) {
        $done({ title: "入口落地查询", htmlMessage: `<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">数据解析失败</p>` });
      }
    }
  });
}

function flagEmoji(code) {
  const c = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(c.codePointAt(0) - 65 + 0x1F1E6, c.codePointAt(1) - 65 + 0x1F1E6);
}