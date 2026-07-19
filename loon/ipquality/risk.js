/**
 * 风险评分查询 - 检测节点出口 IP 的风险评分
 * 
 * 数据源: IPQualityScore (via ipinfo.check.place 聚合)
 * 备用: scamalytics.com
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
      
      // 第二步：查 IPQS 风险评分
      $httpClient.get({ 
        url: `https://ipinfo.check.place/${encodeURIComponent(ip)}?db=ipqualityscore`, 
        node: nodeName, timeout: 8000,
        headers: { "Accept": "application/json", "User-Agent": "curl/8.7.1" },
        alpn: "h2"
      }, (err2, resp2, body2) => {
        if (err2 || !body2) {
          // 备用：查 scamalytics
          $httpClient.get({ 
            url: `https://ipinfo.check.place/${encodeURIComponent(ip)}?db=scamalytics`, 
            node: nodeName, timeout: 8000,
            headers: { "Accept": "application/json", "User-Agent": "curl/8.7.1" },
            alpn: "h2"
          }, (err3, resp3, body3) => {
            if (err3 || !body3) {
              $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">🔴 风险查询超时</p>' });
              return;
            }
            try {
              renderRisk(ip, JSON.parse(body3), "Scamalytics");
            } catch(e) {
              $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">数据解析失败</p>' });
            }
          });
          return;
        }
        try {
          renderRisk(ip, JSON.parse(body2), "IPQS");
        } catch(e) {
          renderRiskFallback(ip);
        }
      });
    } catch(e) {
      $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">IP 解析失败</p>' });
    }
  });
}

function renderRisk(ip, data, source) {
  let html = `<div style="text-align:center;font-family:-apple-system;font-size:14px;line-height:1.8;padding:10px">`;
  html += `━━━━━━━━━━━━━━━━<br>`;
  html += `<b>IP</b> : ${ip}<br>`;
  
  // 尝试从不同数据源提取评分
  let score = data.fraud_score;
  let sourceName = source;
  
  if (score === undefined || score === null) {
    // 可能是 scamalytics 格式
    score = data.scamalytics && data.scamalytics.scamalytics_score;
    sourceName = "Scamalytics";
  }
  
  if (score !== undefined && score !== null) {
    let color = "#00a67d";
    let label = "低风险";
    if (score >= 80) { color = "#8e0000"; label = "极高风险"; }
    else if (score >= 60) { color = "#ff3b30"; label = "高风险"; }
    else if (score >= 40) { color = "#ff9500"; label = "中风险"; }
    html += `<b>风险评分</b> : <span style="color:${color};font-weight:bold">${score} - ${label}</span><br>`;
  } else {
    html += `<b>风险评分</b> : <span style="color:#8e8e93">不可用</span><br>`;
  }
  
  // 风险标记
  const flags = [];
  if (data.proxy === true || data.proxy === "true") flags.push("代理");
  if (data.vpn === true || data.vpn === "true") flags.push("VPN");
  if (data.tor === true || data.tor === "true") flags.push("Tor");
  if (data.recent_abuse === true || data.recent_abuse === "true") flags.push("近期滥用");
  if (data.bot_status === true || data.bot_status === "true") flags.push("机器人");
  if (data.connection_type) html += `<b>连接类型</b> : ${data.connection_type}<br>`;
  if (data.country_code) html += `<b>国家</b> : ${data.country_code}<br>`;
  
  if (flags.length) {
    html += `<b>风险标记</b> : ${flags.map(f => `<span style="color:#ff453a">${f}</span>`).join(" ")}<br>`;
  } else {
    html += `<b>风险标记</b> : <span style="color:#30d158">无</span><br>`;
  }
  
  html += `━━━━━━━━━━━━━━━━<br>`;
  html += `<font color=#6959CD><b>节点</b> ➟ ${nodeName}</font>`;
  html += `<br><span style="font-size:11px;color:#8e8e93">来源: ${sourceName}</span>`;
  html += `</div>`;
  
  $done({ title: "风险评分查询", htmlMessage: html });
}

function renderRiskFallback(ip) {
  let html = `<div style="text-align:center;font-family:-apple-system;font-size:14px;line-height:1.8;padding:10px">`;
  html += `━━━━━━━━━━━━━━━━<br>`;
  html += `<b>IP</b> : ${ip}<br>`;
  html += `<b>风险评分</b> : <span style="color:#8e8e93">不可用</span><br>`;
  html += `━━━━━━━━━━━━━━━━<br>`;
  html += `<font color=#6959CD><b>节点</b> ➟ ${nodeName}</font>`;
  html += `<br><span style="font-size:11px;color:#8e8e93">来源: 无可用数据源</span>`;
  html += `</div>`;
  $done({ title: "风险评分查询", htmlMessage: html });
}