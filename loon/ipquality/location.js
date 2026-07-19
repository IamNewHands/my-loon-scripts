/**
 * 地理位置查询 - 检测节点出口 IP 地理位置
 * 
 * 参考: https://github.com/KOP-XIAO/QuantumultX
 * 数据源: ip-api.com
 * 
 * [Script]
 * generic script-path=https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/ipquality/location.js, tag=地理位置查询, timeout=10, img-url=location.circle.system, enable=true
 */

const params = typeof $environment !== "undefined" && $environment.params ? $environment.params : {};
const nodeName = params.node || "";

console.log(`地理位置查询 - 节点: ${nodeName || "未获取"}`);

if (!nodeName) {
  $done({ title: "地理位置查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">未获取到节点名称</p>' });
} else {
  const url = "http://ip-api.com/json/?fields=query,as,org,isp,countryCode,city,lon,lat";
  $httpClient.get({ url, node: nodeName, timeout: 8000 }, (error, response, data) => {
    if (error) {
      $done({ title: "地理位置查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">🔴 查询超时</p>' });
    } else {
      try {
        const info = JSON.parse(data);
        const paras = ["query", "as", "org", "isp", "countryCode", "city", "lon", "lat"];
        const paran = ["远端IP地址", "远端IP ASN", "ASN所属机构", "远端ISP", "远端IP地区", "远端IP城市", "远端经度", "远端纬度"];
        let res = "-------------------------------";
        for (let i = 0; i < paras.length; i++) {
          let val = info[paras[i]];
          if (paras[i] === "countryCode" && val) {
            val = val + " ⟦" + flagEmoji(val.toUpperCase()) + "⟧";
          }
          res = val ? res + `<br><b>${paran[i]}</b> : ${val}` : res;
        }
        res = res + "<br>-------------------------------" + `<br><font color=#6959CD><b>节点</b> ➟ ${nodeName}</font>`;
        res = `<p style="text-align:center;font-family:-apple-system;font-size:14px;font-weight:thin">${res}</p>`;
        $done({ title: "地理位置查询", htmlMessage: res });
      } catch(e) {
        $done({ title: "地理位置查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">数据解析失败</p>' });
      }
    }
  });
}

function flagEmoji(code) {
  const c = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(c.codePointAt(0) - 65 + 0x1F1E6, c.codePointAt(1) - 65 + 0x1F1E6);
}