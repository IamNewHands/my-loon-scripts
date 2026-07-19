/**
 * 节点 IP 质量检测 · Loon generic 脚本（极速精简版）
 *
 * 基于单个来源（ip-api.com）快速检测节点 IP 地理位置、风险标记、流媒体解锁
 *
 * @Author: MaYIHEI / IamNewHands
 * @Reference: KOP-XIAO, xream, Keywos, dcpengx
 * @Updated: 2026-07-19
 *
 * ===== Loon =====
 * [Script]
 * generic script-path=https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/ipquality/ipquality.js, tag=节点 IP 质量检测, timeout=30, img-url=shield.lefthalf.filled.system, enable=true
 */

const SCRIPT_VERSION = "2026-07-19.r10-fast";
const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const DISNEY_CLIENT_TOKEN = "ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84";

const params = typeof $environment !== "undefined" && $environment.params ? $environment.params : {};
const nodeName = params.node || "";

log(`节点 IP 质量检测 ${SCRIPT_VERSION}`);
log(`节点: ${nodeName || "未获取"}`);

if (!nodeName) { finishError("未获取到节点或策略组名称"); } else { run().catch((e) => finishError(`检测异常: ${errorMessage(e)}`)); }

function log(m) { console.log(`[INFO] ${m}`); }

async function run() {
    // 1. 获取 IP 基础信息（只查 ip-api.com，一个来源，10s timeout）
    const ipInfo = await getIPInfo();
    if (!ipInfo || !ipInfo.query) throw new Error("无法获取节点 IP 信息");

    const ip = ipInfo.query;
    const countryCode = ipInfo.countryCode || "";
    const country = ipInfo.country || "";
    const city = ipInfo.city || "";
    const isp = ipInfo.isp || "";
    const org = ipInfo.org || "";
    const as = ipInfo.as || "";
    const lat = ipInfo.lat;
    const lon = ipInfo.lon;
    const timezone = ipInfo.timezone || "";
    const mobile = ipInfo.mobile;
    const proxy = ipInfo.proxy;
    const hosting = ipInfo.hosting;

    // 2. 解析 ASN
    let asn = "";
    let asOrg = org;
    if (as) {
        const m = as.match(/AS(\d+)/i);
        if (m) asn = m[1];
        if (!asOrg) asOrg = as.replace(/AS\d+\s+/i, "");
    }

    // 3. 流媒体检测（并行）
    const mediaResults = await collectMedia();

    // 4. 渲染
    render(ip, countryCode, country, city, isp, asn, asOrg, lat, lon, timezone, mobile, proxy, hosting, mediaResults);
}

async function getIPInfo() {
    try {
        const data = await requestJson(`http://ip-api.com/json/?fields=status,message,query,country,countryCode,city,isp,org,as,lat,lon,timezone,mobile,proxy,hosting`, { timeout: 10000 });
        if (data && data.status === "success") return data;
        throw new Error(data && data.message || "ip-api 查询失败");
    } catch (e) {
        log(`ip-api 失败: ${errorMessage(e)}`);
        throw e;
    }
}

async function collectMedia() {
    const tests = [
        () => testNetflix(),
        () => testDisneyPlus(),
        () => testYouTube(),
        () => testChatGPT(),
        () => testTikTok(),
    ];
    const settled = await limitedConcurrency(tests, 3);
    const names = ["Netflix", "Disney+", "YouTube", "ChatGPT", "TikTok"];
    return names.map((n, i) => {
        if (settled[i].ok) return settled[i].value;
        log(`${n}: ${settled[i].error}`);
        return { name: n, status: "unknown", region: "", detail: "请求失败" };
    });
}

async function limitedConcurrency(tasks, limit) {
    if (!tasks || tasks.length === 0) return [];
    const results = new Array(tasks.length);
    for (let start = 0; start < tasks.length; start += limit) {
        const end = Math.min(start + limit, tasks.length);
        const batch = [];
        for (let i = start; i < end; i++) {
            const idx = i;
            batch.push(
                Promise.resolve(tasks[idx]()).then(
                    (v) => { results[idx] = { ok: true, value: v }; },
                    (e) => { results[idx] = { ok: false, error: errorMessage(e) }; }
                )
            );
        }
        await Promise.all(batch);
    }
    return results;
}

// ============== 流媒体检测 ==============

async function testNetflix() {
    const rs = await Promise.all([
        request("GET", "https://www.netflix.com/title/70143836", { allowHttpErrors: true }),
        request("GET", "https://www.netflix.com/title/80018499", { allowHttpErrors: true }),
        request("GET", "https://www.netflix.com/title/70143860", { allowHttpErrors: true }),
        request("GET", "https://www.netflix.com/title/70202589", { allowHttpErrors: true }),
    ]);
    const ua = rs.map((r) => /Oh no!|NSEZ-404/i.test(r.body));
    const avail = ua.filter((v) => !v).length;
    if (avail >= 2) {
        const reg = firstMatch(rs[0].body, [/\"countryOfManufacture\"\s*:\s*\"([A-Z]{2})\"/i, /\"locale\"\s*:\s*\"([a-z]{2})-?/i]);
        return { name: "Netflix", status: "yes", region: reg || "", detail: `可看 ${avail}/4` };
    }
    if (avail > 0) return { name: "Netflix", status: "partial", region: "", detail: `可看 ${avail}/4` };
    return { name: "Netflix", status: "no", region: "", detail: "全部不可用" };
}

async function testDisneyPlus() {
    try {
        const d = await requestJson("https://disney.api.edge.bamgrid.com/devices", {
            method: "POST", timeout: 8000,
            headers: { Authorization: `Bearer ${DISNEY_CLIENT_TOKEN}`, "Content-Type": "application/json; charset=UTF-8", "User-Agent": USER_AGENT },
            body: JSON.stringify({ deviceFamily: "browser", applicationRuntime: "chrome", deviceProfile: "windows", attributes: {} }),
        });
        if (!d.assertion) return { name: "Disney+", status: "unknown", region: "", detail: "设备注册失败" };
        const form = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange&latitude=0&longitude=0&platform=browser&subject_token=${encodeURIComponent(d.assertion)}&subject_token_type=urn%3Abamtech%3Aparams%3Aoauth%3Atoken-type%3Adevice`;
        const t = await requestJson("https://disney.api.edge.bamgrid.com/token", {
            method: "POST", allowHttpErrors: true, timeout: 8000,
            headers: { Authorization: `Bearer ${DISNEY_CLIENT_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
            body: form,
        });
        if (t.error_description === "forbidden-location") return { name: "Disney+", status: "no", region: "", detail: "地理位置受限" };
        const region = t.region || t.location || "";
        if (region) return { name: "Disney+", status: "yes", region: region.toUpperCase(), detail: "令牌地区" };
        return { name: "Disney+", status: "unknown", region: "", detail: "未识别" };
    } catch (e) {
        return { name: "Disney+", status: "unknown", region: "", detail: "请求失败" };
    }
}

async function testYouTube() {
    const r = await request("GET", "https://www.youtube.com/premium", { allowHttpErrors: true, timeout: 8000 });
    if (/www\.google\.cn/i.test(r.body)) return { name: "YouTube", status: "no", region: "CN", detail: "跳转 google.cn" };
    const region = firstMatch(r.body, [/"contentRegion"\s*:\s*"([A-Z]{2})"/i]);
    if (/Premium is not available in your country/i.test(r.body)) return { name: "YouTube", status: "no", region: region || "", detail: "不支援 Premium" };
    if (region && /YouTube Premium/i.test(r.body)) return { name: "YouTube", status: "yes", region, detail: "页面地区" };
    return { name: "YouTube", status: "unknown", region: region || "", detail: "未识别" };
}

async function testChatGPT() {
    const r = await request("GET", "https://chatgpt.com/cdn-cgi/trace", { allowHttpErrors: true, timeout: 8000 }).catch(() => null);
    const region = r ? firstMatch(r.body, [/^loc=([A-Z]{2})$/im]) : "";
    if (region) return { name: "ChatGPT", status: "yes", region, detail: "CDN 地区" };
    return { name: "ChatGPT", status: "unknown", region: "", detail: "CDN 未识别" };
}

async function testTikTok() {
    const r = await request("GET", "https://www.tiktok.com/", { allowHttpErrors: true, timeout: 8000 });
    const region = firstMatch(r.body, [/\"region\"\s*:\s*\"([A-Z]{2})\"/i, /\"storeCountry\"\s*:\s*\"([A-Z]{2})\"/i]);
    if (region) return { name: "TikTok", status: "yes", region, detail: "页面地区" };
    if (r.status === 403 || /not available|access denied/i.test(r.body)) return { name: "TikTok", status: "no", region: "", detail: `HTTP ${r.status}` };
    return { name: "TikTok", status: "unknown", region: "", detail: "未识别" };
}

// ============== 渲染 ==============

function render(ip, countryCode, country, city, isp, asn, asOrg, lat, lon, timezone, mobile, proxy, hosting, media) {
    // 构建风险标记
    const flags = [];
    if (proxy === true || proxy === "true") flags.push("代理");
    if (hosting === true || hosting === "true") flags.push("机房");
    if (mobile === true || mobile === "true") flags.push("手机网络");

    const displayNodeName = truncateText(nodeName, 30);
    const locStr = lat && lon ? `${toDMS(lat, true)} ${toDMS(lon, false)}` : "";
    const mapLink = lat && lon ? ` · <a href="${buildMapURL(lat, lon, 0)}" style="color:#0A84FF;text-decoration:none">地图</a>` : "";
    const countryDisplay = countryCode ? `${country} [${countryCode}]` : (country || countryCode || "");
    const network = asn ? `AS${asn} ${asOrg}` : (asOrg || isp || "—");

    const html = [
        '<div style="font-family:-apple-system,BlinkMacSystemFont;font-size:14px;line-height:1.5;text-align:left;overflow-wrap:anywhere">',
        '<div style="height:18px"></div>',
        '<div style="font-size:20px;font-weight:700;margin-bottom:16px">节点 IP 质量检测</div>',
        `<div style="color:#8e8e93;font-size:11px;margin-bottom:10px">节点 · ${esc(displayNodeName)}</div>`,

        // 概要卡片
        '<div style="background:#1c1c1e;border-radius:12px;padding:14px;margin-bottom:12px">',
        `<div style="font-size:13px;font-weight:600">${esc(ip)}</div>`,
        `<div style="margin-top:4px;font-size:12px;color:#8e8e93">${esc(countryDisplay)}</div>`,
        `<div style="margin-top:2px;font-size:12px;color:#8e8e93">${esc(network)}</div>`,
        city ? `<div style="margin-top:2px;font-size:12px;color:#8e8e93">${esc(city)}${locStr ? ' · ' + esc(locStr) : ''}${mapLink}</div>` : "",
        timezone ? `<div style="margin-top:2px;font-size:11px;color:#555">${esc(timezone)}</div>` : "",
        isp && isp !== asOrg ? `<div style="margin-top:2px;font-size:11px;color:#555">ISP: ${esc(isp)}</div>` : "",
        flags.length ? `<div style="margin-top:6px;font-size:12px">${flags.map((f) => `<span style="display:inline-block;background:#3a1a1a;color:#ff453a;border-radius:4px;padding:2px 8px;margin:2px;font-size:11px">${esc(f)}</span>`).join(" ")}</div>` : "",
        '<div style="margin-top:4px;font-size:10px;color:#555">来源: ip-api.com</div>',
        '</div>',

        // 流媒体
        section("流媒体解锁", renderMediaSummary(media)),

        '<div style="height:9px"></div>',
        `<div style="color:#8e8e93;font-size:10px;line-height:1.45">数据来源: ip-api.com。流媒体检测基于 Netflix/Disney+/YouTube/ChatGPT/TikTok 官方页面。</div>`,
        '<div style="height:56px"></div><div style="height:56px"></div></div>',
    ].join("");

    $done({
        title: "\u200B",
        htmlMessage: html,
        icon: "shield.lefthalf.filled",
        "title-color": "#8e8e93",
    });
}

function section(title, content) {
    return `<div style="height:8px"></div><div><div style="color:#0A84FF;font-weight:700;font-size:15px;margin-bottom:9px">▌${esc(title)}</div>${content}</div>`;
}

function renderMediaSummary(media) {
    if (!media || !media.length) return mutedLine("未检测");
    const confirmed = media.filter((r) => r.status !== "unknown");
    const unknown = media.filter((r) => r.status === "unknown");
    const body = confirmed.map((r) => {
        const st = r.status === "yes" ? { text: "✅", color: "#00a67d" } : r.status === "partial" ? { text: "🟠", color: "#ff9500" } : { text: "❌", color: "#ff3b30" };
        const summary = `${st.text} ${esc(r.name)}${r.region ? ' [' + r.region + ']' : ''}`;
        const detail = r.detail ? `<span style="font-size:11px;color:#8e8e93;margin-left:4px">${esc(r.detail)}</span>` : "";
        return `<div style="margin-bottom:8px;font-size:13px">${summary}${detail}</div>`;
    }).join("");
    const unknownLine = unknown.length ? mutedLine(`未确认：${unknown.map((r) => r.name).join("、")}`) : "";
    return (body || mutedLine("未确认任何服务")) + unknownLine;
}

function mutedLine(v) { return `<div style="color:#8e8e93;font-size:11px;margin:5px 0;line-height:1.45">${esc(v)}</div>`; }

// ============== 工具函数 ==============

function esc(t) { return String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function requestJson(url, options) {
    const c = options || {};
    return request(c.method || "GET", url, c).then((r) => { try { return JSON.parse(r.body); } catch (_) { throw new Error("JSON 解析失败"); } });
}

function request(method, url, options) {
    const config = options || {};
    return new Promise((resolve, reject) => {
        const opts = { url, node: nodeName, headers: config.headers || { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8" } };
        if (numberOrNull(config.timeout) !== null) opts.timeout = Number(config.timeout);
        if (typeof config.body !== "undefined") opts.body = config.body;
        const cb = (err, resp, body) => {
            if (err) { reject(new Error(String(err))); return; }
            const s = Number(resp && (resp.status || resp.statusCode));
            if (!config.allowHttpErrors && (!Number.isFinite(s) || s < 200 || s >= 300)) { reject(new Error(`HTTP ${s || "?"}`)); return; }
            resolve({ status: s, body: String(body || ""), response: resp || {} });
        };
        if (String(method).toUpperCase() === "POST") $httpClient.post(opts, cb); else $httpClient.get(opts, cb);
    });
}

function numberOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function truncateText(v, m) { const t = String(v || ""); const l = Number(m) || 0; return l > 1 && t.length > l ? t.slice(0, l - 1) + "…" : t; }
function firstMatch(text, patterns) { for (let i = 0; i < patterns.length; i++) { const m = String(text).match(patterns[i]); if (m) return m[1]; } return ""; }
function toDMS(v, lat) {
    const n = Number(v); if (!Number.isFinite(n)) return "";
    const a = Math.abs(n); let d = Math.floor(a); const mf = (a - d) * 60; let m = Math.floor(mf); let s = Math.round((mf - m) * 60);
    if (s >= 60) { s = 0; m += 1; } if (m >= 60) { m = 0; d += 1; }
    const dir = lat ? (n >= 0 ? "N" : "S") : (n >= 0 ? "E" : "W");
    return `${d}°${m}′${s}″${dir}`;
}
function buildMapURL(lat, lon) { return `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent("节点 IP 出口")}&z=15&t=m`; }
function errorMessage(e) { return e && e.message ? e.message : String(e || "未知错误"); }
function finishError(msg) {
    $done({ title: "\u200B", htmlMessage: `<div style="font-family:-apple-system,BlinkMacSystemFont;font-size:14px;text-align:center;padding:40px 20px;color:#ff3b30">${esc(msg)}</div>`, icon: "shield.lefthalf.filled", "title-color": "#ff3b30" });
}