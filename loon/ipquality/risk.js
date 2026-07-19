/**
 * 风险评分查询 - 检测节点出口 IP 的风险评分
 * 
 * 数据源: IPQualityScore (via ipinfo.check.place 聚合)
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
  // 先获取 IP
  $httpClient.get({ url: "http://ip-api.com/json/?fields=query", node: nodeName, timeout: 6000 }, (err, resp, data) => {
    if (err) {
      $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">🔴 获取 IP 超时</p>' });
      return;
    }
    try {
      const info = JSON.parse(data);
      const ip = info.query;
      if (!ip) throw new Error("未获取到 IP");
      
      // 查 IPQS 风险评分
      $httpClient.get({ 
        url: `https://ipinfo.check.place/${encodeURIComponent(ip)}?db=ipqualityscore`, 
        node: nodeName, timeout: 8000,
        headers: { "Accept": "application/json", "User-Agent": "curl/8.7.1" },
        alpn: "h2"
      }, (err2, resp2, data2) => {
        if (err2) {
          $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">🔴 风险评分查询超时</p>' });
          return;
        }
        try {
          const risk = JSON.parse(data2);
          let html = `<div style="text-align:center;font-family:-apple-system;font-size:14px;line-height:1.8;padding:10px">`;
          html += `━━━━━━━━━━━━━━━━<br>`;
          html += `<b>IP</b> : ${ip}<br>`;
          
          // 风险评分
          const score = risk.fraud_score;
          if (score !== undefined && score !== null) {
            let color = "#00a67d";
            let label = "低风险";
            if (score >= 80) { color = "#8e0000"; label = "极高风险"; }
            else if (score >= 60) { color = "#ff3b30"; label = "高风险"; }
            else if (score >= 40) { color = "#ff9500"; label = "中风险"; }
            html += `<b>风险评分</b> : <span style="color:${color};font-weight:bold">${score} - ${label}</span><br>`;
          }
          
          // 风险标记
          const flags = [];
          if (risk.proxy === true || risk.proxy === "true") flags.push("代理");
          if (risk.vpn === true || risk.vpn === "true") flags.push("VPN");
          if (risk.tor === true || risk.tor === "true") flags.push("Tor");
          if (risk.recent_abuse === true || risk.recent_abuse === "true") flags.push("近期滥用");
          if (risk.bot_status === true || risk.bot_status === "true") flags.push("机器人");
          if (risk.connection_type) html += `<b>连接类型</b> : ${risk.connection_type}<br>`;
          if (risk.country_code) html += `<b>国家</b> : ${risk.country_code}<br>`;
          
          if (flags.length) {
            html += `<b>风险标记</b> : ${flags.map(f => `<span style="color:#ff453a">${f}</span>`).join(" ")}<br>`;
          } else {
            html += `<b>风险标记</b> : <span style="color:#30d158">无</span><br>`;
          }
          
          html += `━━━━━━━━━━━━━━━━<br>`;
          html += `<font color=#6959CD><b>节点</b> ➟ ${nodeName}</font>`;
          html += `<br><span style="font-size:11px;color:#8e8e93">来源: IPQualityScore</span>`;
          html += `</div>`;
          
          $done({ title: "风险评分查询", htmlMessage: html });
        } catch(e) {
          $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">数据解析失败</p>' });
        }
      });
    } catch(e) {
      $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">IP 解析失败</p>' });
    }
  });
}