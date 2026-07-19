/**
 * 节点解锁查询 - 检测节点流媒体与 AI 服务解锁情况
 * 
 * 参考: https://github.com/KOP-XIAO/QuantumultX
 * 检测: Netflix / Disney+ / YouTube / ChatGPT / TikTok
 * 
 * [Script]
 * generic script-path=https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/ipquality/unlock.js, tag=节点解锁查询, timeout=20, img-url=play.circle.system, enable=true
 */

const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const DISNEY_TOKEN = "ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84";

const params = typeof $environment !== "undefined" && $environment.params ? $environment.params : {};
const nodeName = params.node || "";

console.log(`节点解锁查询 - 节点: ${nodeName || "未获取"}`);

if (!nodeName) {
  $done({ title: "节点解锁查询", htmlMessage: '<p style="text-align:center;color:#ff3b30;font-family:-apple-system;font-size:14px;padding:40px 20px">未获取到节点名称</p>' });
} else {
  let result = {
    title: "节点解锁查询",
    Netflix: "<b>Netflix: </b>检测失败 ❗️",
    Disney: "<b>Disney+: </b>检测失败 ❗️",
    YouTube: "<b>YouTube: </b>检测失败 ❗️",
    ChatGPT: "<b>ChatGPT: </b>检测失败 ❗️",
    TikTok: "<b>TikTok: </b>检测失败 ❗️",
  };

  Promise.all([testNetflix(), testDisney(), testYouTube(), testChatGPT(), testTikTok()]).then(() => {
    const content = "------------------------------------<br>" +
      [result.Disney, result.Netflix, result.YouTube, result.ChatGPT, result.TikTok].join("<br><br>") +
      "<br>------------------------------------<br>" + `<font color=#CD5C5C><b>节点</b> ➟ ${nodeName}</font>`;
    $done({ title: result.title, htmlMessage: `<p style="text-align:center;font-family:-apple-system;font-size:14px;font-weight:thin">${content}</p>` });
  }).catch(() => {
    const content = "------------------------------------<br>" +
      [result.Disney, result.Netflix, result.YouTube, result.ChatGPT, result.TikTok].join("<br><br>") +
      "<br>------------------------------------<br>" + `<font color=#CD5C5C><b>节点</b> ➟ ${nodeName}</font>`;
    $done({ title: result.title, htmlMessage: `<p style="text-align:center;font-family:-apple-system;font-size:14px;font-weight:thin">${content}</p>` });
  });
}

function testNetflix() {
  return new Promise((resolve) => {
    const titles = ["70143836", "80018499", "70143860", "70202589"];
    Promise.all(titles.map((id) => {
      return new Promise((r) => {
        $httpClient.get({ url: `https://www.netflix.com/title/${id}`, node: nodeName, timeout: 5000, headers: { "User-Agent": USER_AGENT } }, (err, resp, body) => {
          r({ id, ok: !err && !/Oh no!|NSEZ-404/i.test(body) });
        });
      });
    })).then((results) => {
      const avail = results.filter((r) => r.ok).length;
      if (avail >= 2) {
        result.Netflix = `<b>Netflix: </b>✅ 解锁 (可看 ${avail}/4)`;
      } else if (avail > 0) {
        result.Netflix = `<b>Netflix: </b>🟠 部分可用 (可看 ${avail}/4)`;
      } else {
        result.Netflix = `<b>Netflix: </b>❌ 不可用`;
      }
      resolve();
    });
  });
}

function testDisney() {
  return new Promise((resolve) => {
    $httpClient.post({
      url: "https://disney.api.edge.bamgrid.com/devices",
      node: nodeName, timeout: 6000,
      headers: { Authorization: `Bearer ${DISNEY_TOKEN}`, "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ deviceFamily: "browser", applicationRuntime: "chrome", deviceProfile: "windows", attributes: {} }),
    }, (err, resp, body) => {
      if (err) { result.Disney = `<b>Disney+: </b>❌ 请求失败`; resolve(); return; }
      try {
        const device = JSON.parse(body);
        if (!device.assertion) { result.Disney = `<b>Disney+: </b>❌ 设备注册失败`; resolve(); return; }
        $httpClient.post({
          url: "https://disney.api.edge.bamgrid.com/token",
          node: nodeName, timeout: 6000,
          headers: { Authorization: `Bearer ${DISNEY_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
          body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange&latitude=0&longitude=0&platform=browser&subject_token=${encodeURIComponent(device.assertion)}&subject_token_type=urn%3Abamtech%3Aparams%3Aoauth%3Atoken-type%3Adevice`,
        }, (err2, resp2, body2) => {
          if (err2) { result.Disney = `<b>Disney+: </b>❌ 令牌请求失败`; resolve(); return; }
          try {
            const token = JSON.parse(body2);
            if (token.error_description === "forbidden-location") {
              result.Disney = `<b>Disney+: </b>❌ 地理位置受限`;
            } else {
              const region = (token.region || token.location || "").toUpperCase();
              result.Disney = region ? `<b>Disney+: </b>✅ 解锁 [${region}]` : `<b>Disney+: </b>❌ 未识别`;
            }
          } catch(e) { result.Disney = `<b>Disney+: </b>❌ 解析失败`; }
          resolve();
        });
      } catch(e) { result.Disney = `<b>Disney+: </b>❌ 解析失败`; resolve(); }
    });
  });
}

function testYouTube() {
  return new Promise((resolve) => {
    $httpClient.get({ url: "https://www.youtube.com/premium", node: nodeName, timeout: 5000, headers: { "User-Agent": USER_AGENT } }, (err, resp, body) => {
      if (err) { result.YouTube = `<b>YouTube: </b>❌ 请求失败`; resolve(); return; }
      if (/www\.google\.cn/i.test(body)) {
        result.YouTube = `<b>YouTube: </b>❌ 跳转至 google.cn`;
      } else if (/Premium is not available in your country/i.test(body)) {
        result.YouTube = `<b>YouTube: </b>❌ 不支援 Premium`;
      } else {
        const region = body.match(/"contentRegion"\s*:\s*"([A-Z]{2})"/i);
        result.YouTube = region ? `<b>YouTube: </b>✅ 解锁 [${region[1]}]` : `<b>YouTube: </b>✅ 可访问`;
      }
      resolve();
    });
  });
}

function testChatGPT() {
  return new Promise((resolve) => {
    $httpClient.get({ url: "https://chatgpt.com/cdn-cgi/trace", node: nodeName, timeout: 5000 }, (err, resp, body) => {
      if (err) { result.ChatGPT = `<b>ChatGPT: </b>❌ 请求失败`; resolve(); return; }
      const region = body ? body.match(/^loc=([A-Z]{2})$/im) : null;
      result.ChatGPT = region ? `<b>ChatGPT: </b>✅ 解锁 [${region[1]}]` : `<b>ChatGPT: </b>❌ 不可用`;
      resolve();
    });
  });
}

function testTikTok() {
  return new Promise((resolve) => {
    $httpClient.get({ url: "https://www.tiktok.com/", node: nodeName, timeout: 5000, headers: { "User-Agent": USER_AGENT } }, (err, resp, body) => {
      if (err) { result.TikTok = `<b>TikTok: </b>❌ 请求失败`; resolve(); return; }
      const region = body ? body.match(/"region"\s*:\s*"([A-Z]{2})"/i) : null;
      result.TikTok = region ? `<b>TikTok: </b>✅ 解锁 [${region[1]}]` : `<b>TikTok: </b>❌ 不可用`;
      resolve();
    });
  });
}