/**
 * 风险评分查询 - 检测节点出口 IP 的风险评分
 * 
 * 数据源: scamalytics.com
 * 
 * [Script]
 * generic script-path=https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/ipquality/risk.js, tag=风险评分查询, timeout=10, img-url=shield.lefthalf.filled.system, enable=true
 */

const params = typeof $environment !== "undefined" && $environment.params ? $environment.params : {};
const nodeName = params.node || "";

console.log(`风险评分查询 - 节点: ${nodeName || "未获取"}`);

if (!nodeName) {
  $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">未获取到节点名称</p>' });
} else {
  // 第一步：获取 IP
  $httpClient.get({ url: "http://ip-api.com/json/?fields=query", node: nodeName, timeout: 6000 }, (err, resp, body) => {
    if (err || !body) {
      $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">🔴 获取 IP 超时</p>' });
      return;
    }
    try {
      const info = JSON.parse(body);
      const ip = info.query;
      if (!ip) throw new Error("未获取到 IP");
      
      // 第二步：查 scamalytics.com 风险评分
      $httpClient.get({ 
        url: `https://scamalytics.com/ip/${ip}`,
        node: nodeName, timeout: 8000,
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
      }, (err2, resp2, body2) => {
        if (err2 || !body2) {
          $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">🔴 风险查询超时</p>' });
          return;
        }
        try {
          renderRisk(ip, body2);
        } catch(e) {
          $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">数据解析失败</p>' });
        }
      });
    } catch(e) {
      $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">IP 解析失败</p>' });
    }
  });
}

function renderRisk(ip, html) {
  let score = "";
  let riskLabel = "";
  let riskColor = "#8e8e93";
  
  // 解析 Fraud Score
  let scoreMatch = html.match(/Fraud\s*Score\s*:?\s*(?:<[^>]+>\s*)*(\d{1,3})/i);
  if (scoreMatch) {
    score = scoreMatch[1];
    let s = parseInt(score);
    if (s >= 80) { riskLabel = "极高风险"; riskColor = "#8e0000"; }
    else if (s >= 60) { riskLabel = "高风险"; riskColor = "#ff3b30"; }
    else if (s >= 40) { riskLabel = "中风险"; riskColor = "#ff9500"; }
    else { riskLabel = "低风险"; riskColor = "#00a67d"; }
  }
  
  // 解析代理/VPN 标记
  let isProxy = html.match(/Proxy\s*Score\s*:?\s*(?:<[^>]+>\s*)*(\d{1,3})/i);
  let isVpn = html.match(/VPN\s*Score\s*:?\s*(?:<[^>]+>\s*)*(\d{1,3})/i);
  let isDatacenter = html.match(/Data Center/i);
  
  let flags = [];
  if (isProxy && parseInt(isProxy[1]) > 50) flags.push("代理");
  if (isVpn && parseInt(isVpn[1]) > 50) flags.push("VPN");
  if (isDatacenter) flags.push("机房");
  
  let output = `<div style="text-align:center;font-family:-apple-system;font-size:14px;line-height:1.8;padding:10px">`;
  output += `━━━━━━━━━━━━━━━━<br>`;
  output += `<b>IP</b> : ${ip}<br>`;
  
  if (score) {
    output += `<b>欺诈评分</b> : <span style="color:${riskColor};font-weight:bold">${score} - ${riskLabel}</span><br>`;
  }
  if (isProxy) output += `<b>代理评分</b> : ${isProxy[1]}<br>`;
  if (isVpn) output += `<b>VPN 评分</b> : ${isVpn[1]}<br>`;
  
  if (flags.length) {
    output += `<b>风险标记</b> : ${flags.map(f => `<span style="color:#ff453a">${f}</span>`).join(" ")}<br>`;
  } else {
    output += `<b>风险标记</b> : <span style="color:#30d158">无</span><br>`;
  }
  
  output += `━━━━━━━━━━━━━━━━<br>`;
  output += `<font color=#6959CD><b>节点</b> ➟ ${nodeName}</font>`;
  output += `<br><span style="font-size:11px;color:#8e8e93">来源: scamalytics.com</span>`;
  output += `</div>`;
  
  $done({ title: "风险评分查询", htmlMessage: output });
}