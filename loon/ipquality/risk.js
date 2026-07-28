/**
 * 风险评分查询 - 检测节点出口 IP 的风险评分
 * 
 * 数据源: ipapi.is
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
  $httpClient.get({ url: `https://api.ipapi.is/?q=`, node: nodeName, timeout: 8000, headers: { "Accept": "application/json" } }, (err, resp, body) => {
    if (err || !body) {
      $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">🔴 风险查询超时</p>' });
      return;
    }
    try {
      const data = JSON.parse(body);
      const ip = data.ip || "";
      let html = `<div style="text-align:center;font-family:-apple-system;font-size:14px;line-height:1.8;padding:10px">`;
      html += `━━━━━━━━━━━━━━━━<br>`;
      html += `<b>IP</b> : ${ip}<br>`;
      
      // 风险标记
      let flags = [];
      if (data.is_proxy) flags.push("代理");
      if (data.is_vpn) flags.push("VPN");
      if (data.is_tor) flags.push("Tor");
      if (data.is_datacenter) flags.push("机房");
      if (data.is_abuser) flags.push("滥用");
      if (data.is_crawler) flags.push("爬虫");
      if (data.is_mobile) flags.push("手机网络");
      
      // 滥用评分
      let abuserScore = "";
      if (data.company && data.company.abuser_score) abuserScore = data.company.abuser_score;
      if (!abuserScore && data.asn && data.asn.abuser_score) abuserScore = data.asn.abuser_score;
      
      if (abuserScore) {
        let scoreColor = "#00a67d";
        if (abuserScore.indexOf("High") != -1 || abuserScore.indexOf("Elevated") != -1) scoreColor = "#ff9500";
        if (abuserScore.indexOf("Very High") != -1) scoreColor = "#ff3b30";
        html += `<b>滥用评分</b> : <span style="color:${scoreColor}">${abuserScore}</span><br>`;
      }
      
      // 数据中心
      if (data.datacenter && data.datacenter.datacenter) {
        html += `<b>数据中心</b> : ${data.datacenter.datacenter}<br>`;
      }
      
      // 公司信息
      if (data.company && data.company.name) {
        html += `<b>组织</b> : ${data.company.name}<br>`;
        if (data.company.type) html += `<b>类型</b> : ${data.company.type}<br>`;
      }
      
      // ASN
      if (data.asn) {
        html += `<b>ASN</b> : AS${data.asn.asn}<br>`;
      }
      
      if (flags.length) {
        html += `<b>风险标记</b> : ${flags.map(f => `<span style="color:#ff453a">${f}</span>`).join(" ")}<br>`;
      } else {
        html += `<b>风险标记</b> : <span style="color:#30d158">无</span><br>`;
      }
      
      html += `━━━━━━━━━━━━━━━━<br>`;
      html += `<font color=#6959CD><b>节点</b> ➟ ${nodeName}</font>`;
      html += `<br><span style="font-size:11px;color:#8e8e93">来源: ipapi.is</span>`;
      html += `</div>`;
      
      $done({ title: "风险评分查询", htmlMessage: html });
    } catch(e) {
      $done({ title: "风险评分查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">数据解析失败</p>' });
    }
  });
}