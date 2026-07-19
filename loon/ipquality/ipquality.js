/**
 * 节点 IP 质量检测 · Loon generic 脚本（精简去重版）
 *
 * 使用:在 Loon 的节点或策略组页面对目标执行「节点 IP 质量检测」
 *
 * @Author: MaYIHEI <https://github.com/MaYIHEI/paperclip>
 * @Optimized: IamNewHands
 * @Reference: @Roddy-D <https://github.com/Roddy-D/Loon_plugins>
 * @Reference: @xykt <https://github.com/xykt/IPQuality>
 * @Updated: 2026-07-19
 *
 * ===== Loon =====
 * [Script]
 * generic script-path=https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/ipquality/ipquality.js, tag=节点 IP 质量检测, timeout=50, img-url=shield.lefthalf.filled.system, enable=true
 */

const SCRIPT_VERSION = "2026-07-19.r9-opt";
const IPPURE_URL = "https://my.ippure.com/v1/info";
const IPIFY_URL = "https://api4.ipify.org?format=json";
const IPAPI_URL = "https://api.ipapi.is/";
const IPQUALITY_BACKEND = "https://ipinfo.check.place";
const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const DISNEY_CLIENT_TOKEN = "ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84";
const MAX_CONCURRENCY = 4;
const CACHE_TTL_MS = 180000;

const params = typeof $environment !== "undefined" && $environment.params ? $environment.params : {};
const nodeName = params.node || "";
const maskIP = readSwitch("MaskIP", false);
const mediaEnabled = readSwitch("MediaTest", true);
const mapNotificationEnabled = readSwitch("MapNotification", false);

const _cache = new Map();
function cacheGet(key) { const e = _cache.get(key); if (e && Date.now() - e.ts < CACHE_TTL_MS) return e.data; _cache.delete(key); return null; }
function cacheSet(key, data) { _cache.set(key, { data, ts: Date.now() }); }

log(`节点 IP 质量检测 ${SCRIPT_VERSION}`);
log(`节点: ${nodeName || "未获取"}`);

if (!nodeName) { finishError("未获取到节点或策略组名称"); } else { run().catch((e) => finishError(`检测异常: ${errorMessage(e)}`)); }

function log(m) { console.log(`[INFO] ${m}`); }
function warn(m) { console.log(`[WARN] ${m}`); }

async function run() {
    const discovery = await discoverIP();
    if (!discovery.ip) throw new Error("无法获取所选节点的出口 IP");
    const ip = discovery.ip;
    const cacheKey = `result_${ip}`;
    const cached = cacheGet(cacheKey);
    if (cached) { log(`使用缓存: ${ip}`); render(ip, cached); return; }
    const data = await collectDatabases(ip, discovery);
    cacheSet(cacheKey, data);
    render(ip, data);
}

// 分块批量并发
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

async function discoverIP() {
    const defs = [
        ["ipinfo.check.place", () => requestText(`${IPQUALITY_BACKEND}/cdn-cgi/trace`)],
        ["ipify", () => requestJson(IPIFY_URL)],
        ["ip-api", () => requestJson(`http://ip-api.com/json/?fields=status,message,query`)],
        ["ident.me", () => requestText("https://v4.ident.me/")],
        ["icanhazip", () => requestText("https://ipv4.icanhazip.com/")],
        ["IPPure", () => requestIppure()],
        ["ipapi", () => requestJson(IPAPI_URL)],
    ];
    const settled = await limitedConcurrency(defs.map((d) => d[1]), MAX_CONCURRENCY);
    let ippure = null, ippureError = "", ipapi = null;
    const obs = [];
    defs.forEach((item, i) => {
        const r = settled[i];
        if (!r.ok) { if (item[0] === "IPPure") ippureError = r.error; warn(`探针 ${item[0]}: ${r.error}`); return; }
        const v = r.value;
        if (item[0] === "IPPure") ippure = v;
        if (item[0] === "ipapi") ipapi = v;
        let c = "";
        if (item[0] === "ipinfo.check.place") { const m = String(v || "").match(/(?:^|\n)ip=([^\r\n]+)/); c = m ? m[1].trim() : ""; }
        else if (item[0] === "ip-api") c = v && v.query;
        else if (item[0] === "ipify") c = v && v.ip;
        else if (item[0] === "IPPure" || item[0] === "ipapi") c = v && v.ip;
        else c = String(v || "").trim();
        const nc = normalizeIPAddress(c);
        if (nc) obs.push({ source: item[0], ip: nc });
    });
    if (!obs.length) return { ip: "", ippure: null, ipapi: null, probe: { matched: 0, total: 0 } };
    const counts = {};
    obs.forEach((o) => { counts[o.ip] = (counts[o.ip] || 0) + 1; });
    const backend = obs.find((o) => o.source === "ipinfo.check.place") || obs[0];
    const ip = backend.ip;
    const matchingIpapi = ipapi && normalizeIPAddress(ipapi.ip) === ip ? ipapi : null;
    const unique = Object.keys(counts);
    if (unique.length > 1) warn(`出口探针不一致: ${obs.map((o) => `${o.source}=${o.ip}`).join(", ")}`);
    return { ip, ippure, ippureError, ipapi: matchingIpapi, probe: { matched: counts[ip], total: obs.length, unique: unique.length } };
}

async function collectDatabases(ip, discovery) {
    const pathIP = encodeURIComponent(ip);
    const tasks = [
        () => requestBackendJson(`${IPQUALITY_BACKEND}/${pathIP}?lang=cn`),
        () => discovery.ippure ? Promise.resolve(discovery.ippure) : Promise.reject(new Error(discovery.ippureError || "IPPure 失败")),
        () => discovery.ipapi ? Promise.resolve(discovery.ipapi) : requestJson(`${IPAPI_URL}?q=${pathIP}`, { node: "DIRECT" }),
        () => requestScamalytics(pathIP),
        () => requestBackendJson(`${IPQUALITY_BACKEND}/${pathIP}?db=ip2location`),
        () => requestBackendJson(`${IPQUALITY_BACKEND}/${pathIP}?db=ipqualityscore`),
        () => requestJson(`https://ipinfo.io/widget/demo/${pathIP}`, { node: "DIRECT" }),
    ];
    const keys = ["maxmind", "ippure", "ipapi", "scamalytics", "ip2locationFull", "ipqs", "ipinfo"];
    const settled = await limitedConcurrency(tasks, MAX_CONCURRENCY);
    const data = { _errors: {}, _warnings: {}, _probe: discovery.probe || { matched: 0, total: 0, unique: 0 } };
    keys.forEach((key, i) => {
        const v = settled[i].ok ? settled[i].value : null;
        if (key === "ippure" && v && !normalizeIPAddress(v.ip)) { data[key] = null; data._errors[key] = "IPPure IP 不符"; return; }
        data[key] = v;
        if (!settled[i].ok) data._errors[key] = settled[i].error;
    });
    return data;
}

async function requestBackendJson(url) {
    let lastErr = null;
    for (let a = 1; a <= 2; a++) {
        try { return await requestJson(url); }
        catch (e) { lastErr = e; if (!/HTTP 403/i.test(errorMessage(e)) || a >= 2) throw e; warn(`聚合接口 403 重试 ${a}`); }
    }
    throw lastErr || new Error("聚合接口失败");
}

async function requestIppure() {
    for (let a = 1; a <= 2; a++) {
        try {
            const v = await requestJson(IPPURE_URL, { headers: {}, timeout: 6000 });
            if (!normalizeIPAddress(v && v.ip)) throw new Error("IP 无效");
            if (numberOrNull(v.fraudScore) === null || v.fraudScore < 0 || v.fraudScore > 100) throw new Error("评分无效");
            return v;
        } catch (e) { if (a < 2) warn(`IPPure 重试 ${a}: ${errorMessage(e)}`); else throw e; }
    }
}

async function requestScamalytics(pathIP) {
    try {
        const b = await requestBackendJson(`${IPQUALITY_BACKEND}/${pathIP}?db=scamalytics`);
        if (numberOrNull(valueAt(b, "scamalytics.scamalytics_score")) === null) throw new Error("无评分");
        return b;
    } catch (e) {
        warn(`Scamalytics 聚合失败: ${errorMessage(e)}`);
        try {
            const html = await requestText(`https://scamalytics.com/ip/${pathIP}`, { headers: browserHeaders() });
            const p = parseScamalyticsHtml(html, decodeURIComponent(pathIP));
            if (!p) throw new Error("官网解析失败");
            return p;
        } catch (e2) { throw e2; }
    }
}

// ============== 渲染（去重汇总版） ==============

function render(ip, data) {
    const basic = buildBasicSummary(ip, data);
    const ipType = buildTypeSummary(data);
    const risks = buildRiskSummary(data);
    const flags = buildFlagSummary(data);
    const audit = buildAuditSummary(data);
    const titleColor = risks.highest >= 3 ? "#ff453a" : risks.highest >= 2 ? "#ff9f0a" : "#30d158";
    const displayNodeName = truncateText(nodeName, 30);

    if (mediaEnabled) {
        // 先显示基础信息，流媒体异步加载后自动更新
        renderNow(ip, basic, ipType, risks, flags, null, audit, titleColor, displayNodeName);
        // 流媒体结果通过 $notification 或缓存方式返回
        collectMedia().then((m) => {
            data._media = m;
            // 用 $notification 补充显示流媒体结果
            const yes = m.filter((r) => r.status === "yes").length;
            const no = m.filter((r) => r.status === "no").length;
            const msg = `解锁 ${yes} 个 · 不可用 ${no} 个 · 未确认 ${m.length - yes - no} 个`;
            if (mapNotificationEnabled) {
                try { $notification.post("流媒体检测完成", msg, ""); } catch (_) {}
            }
        }).catch(() => {});
    } else {
        renderNow(ip, basic, ipType, risks, flags, null, audit, titleColor, displayNodeName);
    }
}

function renderNow(ip, basic, ipType, risks, flags, media, audit, titleColor, displayNodeName) {
    const html = [
        '<div style="font-family:-apple-system,BlinkMacSystemFont;font-size:14px;line-height:1.5;text-align:left;overflow-wrap:anywhere">',
        '<div style="height:18px"></div>',
        '<div style="font-size:20px;font-weight:700;margin-bottom:16px">节点 IP 质量检测</div>',
        `<div style="color:#8e8e93;font-size:11px;margin-bottom:10px">节点 · ${esc(displayNodeName)}</div>`,
        summaryCard(basic),
        section("基础信息", renderBasicSummary(basic)),
        section("IP 类型", renderTypeSummary(ipType)),
        section("风险评分", renderRiskSummary(risks)),
        collapsibleSection("风险标记", renderFlagSummary(flags)),
        section("流媒体与 AI", media ? renderMediaSummary(media) : mutedLine("流媒体检测中，请稍后查看通知…")),
        section("数据状态", renderAuditSummary(audit)),
        '<div style="height:9px"></div>',
        `<div style="color:#8e8e93;font-size:10px;line-height:1.45">多源汇总展示，去重合并。各库结果独立，不生成综合结论。</div>`,
        '<div style="height:56px"></div><div style="height:56px"></div></div>',
    ].filter(Boolean).join("");

    postMapNotification(basic, displayNodeName);
    $done({
        title: "\u200B",
        htmlMessage: html,
        icon: "shield.lefthalf.filled",
        "title-color": titleColor,
    });
}

// ============== 汇总函数 ==============

function buildBasicSummary(ip, data) {
    const maxmind = data.maxmind || {};
    const ipapi = data.ipapi || {};
    const ipinfo = data.ipinfo && data.ipinfo.data ? data.ipinfo.data : {};
    const ippure = data.ippure && !data.ippure._egressMismatch ? data.ippure : {};
    const ip2 = getIp2location(data) || {};
    const loc = ipapi.location || {};
    const asn = ipapi.asn || {};

    // 国家：优先取一致的
    const countryCode = cleanValue(ipapi.country_code || valueAt(ipapi, "location.country_code") || maxmind.Country?.IsoCode || ipinfo.country || ip2.country_code || "");
    const countryName = cleanValue(loc.country || maxmind.Country?.Name || ipinfo.country_name || ip2.country_name || "");
    const city = cleanValue(loc.city || ipinfo.city || ip2.city_name || maxmind.City?.Name || ippure.city || "");
    const region = cleanValue(ipinfo.region || loc.state || "");

    // ASN：多源合并
    const asnNumber = cleanASN(asn.asn || valueAt(ipinfo, "asn.asn") || ip2.asn || maxmind.ASN?.AutonomousSystemNumber || ippure.asn || "");
    const org = cleanValue(asn.org || valueAt(ipinfo, "asn.name") || ip2.as || maxmind.ASN?.AutonomousSystemOrganization || ippure.asOrganization || "");

    // 坐标：多源合并
    const lat = numberOrNull(loc.latitude || ip2.latitude || splitCoordinate(ipinfo.loc, 0) || maxmind.City?.Latitude || ippure.latitude);
    const lon = numberOrNull(loc.longitude || ip2.longitude || splitCoordinate(ipinfo.loc, 1) || maxmind.City?.Longitude || ippure.longitude);

    // 时区
    const tz = cleanValue(loc.timezone || ipinfo.timezone || ippure.timezone || "");

    // 路由
    const route = cleanValue(asn.route || valueAt(ipinfo, "asn.route") || maxmind.ASN?.Network || "");

    return { ip: maskIPAddress(ip), countryCode, countryName, city, region, asn: asnNumber, org, lat, lon, tz, route };
}

function buildTypeSummary(data) {
    const ip2 = getIp2location(data);
    const ipapi = data.ipapi;
    const ipqs = data.ipqs && data.ipqs.success !== false ? data.ipqs : null;
    const ippure = data.ippure && !data.ippure._egressMismatch ? data.ippure : {};
    const results = [];

    // 多源汇总 IP 类型
    const types = [];
    if (ip2 && ip2.usage_type) types.push({ source: "IP2Location", type: formatType(ip2.usage_type), raw: ip2.usage_type });
    if (ipapi) {
        const t = valueAt(ipapi, "asn.type");
        if (t) types.push({ source: "ipapi", type: formatType(t), raw: t });
    }
    if (ipqs && ipqs.connection_type) types.push({ source: "IPQS", type: formatType(ipqs.connection_type), raw: ipqs.connection_type });
    if (ippure && ippure.usageType) types.push({ source: "IPPure", type: formatType(ippure.usageType), raw: ippure.usageType });

    // 去重：相同 type 只保留一个，标注来源
    const seen = {};
    types.forEach((t) => {
        if (!seen[t.type]) seen[t.type] = [];
        seen[t.type].push(t.source);
    });

    return Object.keys(seen).map((type) => ({
        type,
        sources: seen[type].join("/"),
    }));
}

function buildRiskSummary(data) {
    const ipqs = data.ipqs && data.ipqs.success !== false ? data.ipqs : null;
    const scam = data.scamalytics?.scamalytics;
    const ip2 = getIp2location(data);
    const ipapi = data.ipapi;
    const scores = [];
    if (ipqs && numberOrNull(ipqs.fraud_score) !== null) scores.push({ name: "IPQS", score: ipqs.fraud_score, source: "IPQS" });
    if (scam && numberOrNull(scam.scamalytics_score) !== null) scores.push({ name: "Scamalytics", score: scam.scamalytics_score, source: "Scamalytics" });
    if (ip2 && numberOrNull(ip2.fraud_score) !== null) scores.push({ name: "IP2Location", score: ip2.fraud_score, source: "IP2Location" });
    if (ipapi && numberOrNull(ipapi.risk_score) !== null) scores.push({ name: "ipapi", score: ipapi.risk_score, source: "ipapi" });
    else if (ipapi && ipapi.risk_level) scores.push({ name: "ipapi", score: null, level: ipapi.risk_level, source: "ipapi" });

    const highest = scores.reduce((max, s) => Math.max(max, s.score !== null ? s.score : 0), 0);
    return { scores, highest };
}

function buildFlagSummary(data) {
    const ipinfo = data.ipinfo && data.ipinfo.data ? data.ipinfo.data : null;
    const ipapi = data.ipapi;
    const ip2 = getIp2location(data);
    const ip2Proxy = ip2?.proxy || {};
    const ipqs = data.ipqs && data.ipqs.success !== false ? data.ipqs : null;
    const scam = data.scamalytics?.scamalytics;
    const scamRoot = data.scamalytics;

    // 收集所有标记，按类别合并
    const flagMap = {};

    function addFlag(category, value, source) {
        if (value === true || value === "true" || value === 1 || value === "1") {
            if (!flagMap[category]) flagMap[category] = { hit: true, sources: [] };
            flagMap[category].sources.push(source);
        } else if (value === false || value === "false" || value === 0 || value === "0") {
            if (!flagMap[category]) flagMap[category] = { hit: false, sources: [] };
            flagMap[category].sources.push(source);
        }
    }

    // IP2Location
    addFlag("代理", anyTrue([ip2?.is_proxy, ip2Proxy.is_public_proxy, ip2Proxy.is_web_proxy]), "IP2L");
    addFlag("Tor", ip2Proxy.is_tor, "IP2L");
    addFlag("VPN", ip2Proxy.is_vpn, "IP2L");
    addFlag("机房", ip2Proxy.is_data_center, "IP2L");
    addFlag("滥用", ip2Proxy.is_spammer, "IP2L");
    addFlag("机器人", anyTrue([ip2Proxy.is_web_crawler, ip2Proxy.is_scanner, ip2Proxy.is_botnet]), "IP2L");

    // ipapi
    addFlag("VPN", ipapi?.is_vpn, "ipapi");
    addFlag("代理", ipapi?.is_proxy, "ipapi");
    addFlag("Tor", ipapi?.is_tor, "ipapi");
    addFlag("机房", ipapi?.is_datacenter, "ipapi");
    addFlag("滥用", ipapi?.is_abuser, "ipapi");
    addFlag("爬虫", ipapi?.is_crawler, "ipapi");

    // IPQS
    addFlag("代理", ipqs?.proxy, "IPQS");
    addFlag("Tor", ipqs?.tor, "IPQS");
    addFlag("VPN", ipqs?.vpn, "IPQS");
    addFlag("滥用", ipqs?.recent_abuse, "IPQS");
    addFlag("机器人", ipqs?.bot_status, "IPQS");

    // Scamalytics
    addFlag("代理", valueAt(scamRoot, "external_datasources.firehol.is_proxy"), "Scam");
    addFlag("Tor", valueAt(scamRoot, "external_datasources.x4bnet.is_tor"), "Scam");
    addFlag("VPN", scam?.scamalytics_proxy?.is_vpn, "Scam");
    addFlag("机房", scam?.scamalytics_proxy?.is_datacenter, "Scam");
    addFlag("滥用", scam?.is_blacklisted_external, "Scam");

    // IPinfo
    addFlag("VPN", valueAt(ipinfo, "privacy.vpn"), "IPinfo");
    addFlag("代理", valueAt(ipinfo, "privacy.proxy"), "IPinfo");
    addFlag("Tor", valueAt(ipinfo, "privacy.tor"), "IPinfo");
    addFlag("中继", valueAt(ipinfo, "privacy.relay"), "IPinfo");
    addFlag("机房", valueAt(ipinfo, "privacy.hosting"), "IPinfo");

    return flagMap;
}

function buildAuditSummary(data) {
    const checks = [
        ["MaxMind", !!(data.maxmind && (data.maxmind.Country || data.maxmind.ASN))],
        ["IPPure", !!(data.ippure && data.ippure.ip)],
        ["ipapi", !!(data.ipapi && data.ipapi.ip)],
        ["IPinfo", !!(data.ipinfo && data.ipinfo.data)],
        ["IP2Location", !!getIp2location(data)],
        ["Scamalytics", !!(data.scamalytics && numberOrNull(valueAt(data.scamalytics, "scamalytics.scamalytics_score")) !== null)],
        ["IPQS", !!(data.ipqs && data.ipqs.success !== false && numberOrNull(data.ipqs.fraud_score) !== null)],
    ];
    return {
        total: checks.length,
        success: checks.filter((c) => c[1]).map((c) => c[0]),
        failed: checks.filter((c) => !c[1]).map((c) => c[0]),
    };
}

// ============== 渲染子函数（精简版） ==============

function summaryCard(basic) {
    const loc = basic.lat && basic.lon
        ? `<span style="color:#8e8e93">${basic.city ? esc(basic.city) + ' · ' : ''}${toDMS(basic.lat, true)} ${toDMS(basic.lon, false)}</span>`
        : (basic.city ? `<span style="color:#8e8e93">${esc(basic.city)}</span>` : "");
    const mapLink = basic.lat && basic.lon
        ? ` · <a href="${buildMapURL(basic.lat, basic.lon, 0)}" style="color:#0A84FF;text-decoration:none">地图</a>` : "";
    const countryDisplay = basic.countryCode ? `${basic.countryName} [${basic.countryCode}]` : basic.countryName || basic.countryCode || "";
    return `<div style="background:#1c1c1e;border-radius:12px;padding:14px;margin-bottom:12px">`
        + `<div style="font-size:13px;font-weight:600">${esc(basic.ip)}</div>`
        + `<div style="margin-top:4px;font-size:12px;color:#8e8e93">${esc(countryDisplay)}</div>`
        + (basic.org ? `<div style="margin-top:2px;font-size:12px;color:#8e8e93">${basic.asn ? 'AS' + basic.asn + ' ' : ''}${esc(basic.org)}</div>` : "")
        + (basic.route ? `<div style="margin-top:2px;font-size:11px;color:#555">${esc(basic.route)}</div>` : "")
        + (loc || basic.tz ? `<div style="margin-top:4px;font-size:12px">${loc}${basic.tz ? ' ' + esc(basic.tz) : ''}${mapLink}</div>` : "")
        + `</div>`;
}

function section(title, content) {
    return `<div style="height:8px"></div><div><div style="color:#0A84FF;font-weight:700;font-size:15px;margin-bottom:9px">▌${esc(title)}</div>${content}</div>`;
}

function collapsibleSection(title, content) {
    const id = "sec_" + title.replace(/\s+/g, "_");
    return `<div style="height:8px"></div><div><div style="color:#0A84FF;font-weight:700;font-size:15px;margin-bottom:9px">▌${esc(title)}</div>`
        + `<div id="${id}">${content}</div>`
        + `<div style="font-size:11px;color:#8e8e93;text-align:center;margin:4px 0" onclick="var e=document.getElementById('${id}');var b=this;if(e.style.display==='none'){e.style.display='';b.innerText='▲ 收起'}else{e.style.display='none';b.innerText='▼ 展开'}" id="${id}_btn">▼ 展开</div>`
        + `<script>document.getElementById('${id}').style.display='none';document.getElementById('${id}_btn').innerText='▼ 展开'</script></div>`;
}

function renderBasicSummary(basic) {
    const country = basic.countryCode ? `${basic.countryName} [${basic.countryCode}]` : basic.countryName || basic.countryCode || "—";
    const network = basic.asn ? `AS${basic.asn} ${basic.org}` : (basic.org || "—");
    const rows = [
        ["IP 地址", basic.ip],
        ["国家", country],
        ["城市", basic.city || "—"],
        ["网络", network],
        basic.route ? ["路由", basic.route] : null,
        basic.tz ? ["时区", basic.tz] : null,
    ].filter(Boolean);
    return rows.map((r) => infoLine(r[0], r[1])).join("");
}

function renderTypeSummary(types) {
    if (!types.length) return mutedLine("未获取到类型信息");
    return types.map((t) => {
        return `<div style="margin-bottom:6px;line-height:1.4"><span style="font-weight:600">${esc(t.type)}</span><span style="font-size:11px;color:#8e8e93;margin-left:6px">(${esc(t.sources)})</span></div>`;
    }).join("");
}

function renderRiskSummary(risks) {
    if (!risks.scores.length) return mutedLine("未获取到风险评分");
    return risks.scores.map((s) => {
        const label = s.score !== null
            ? (s.score >= 80 ? "极高风险" : s.score >= 60 ? "高风险" : s.score >= 40 ? "中风险" : "低风险")
            : (s.level || "未知");
        const color = s.score !== null ? (s.score >= 80 ? "#8e0000" : s.score >= 60 ? "#ff3b30" : s.score >= 40 ? "#ff9500" : "#00a67d") : "#8e8e93";
        const detail = s.score !== null ? String(s.score) : s.level || "";
        return `<div style="margin-bottom:8px;line-height:1.4"><span style="font-weight:600">${esc(s.name)}</span>`
            + `<span style="float:right;color:${color};font-weight:700">${esc(label)}</span>`
            + `<div style="font-size:11px;color:#8e8e93;margin-top:1px">${esc(detail)}</div></div>`;
    }).join("");
}

function renderFlagSummary(flagMap) {
    const keys = Object.keys(flagMap);
    if (!keys.length) return mutedLine("未获取到风险标记");
    const hit = keys.filter((k) => flagMap[k].hit);
    const clear = keys.filter((k) => !flagMap[k].hit);
    const parts = [];
    if (hit.length) parts.push(`<div style="margin-bottom:8px"><span style="color:#ff453a;font-weight:600">命中</span><div style="margin-top:4px;font-size:12px;line-height:1.6">${hit.map((k) => `<span style="display:inline-block;background:#3a1a1a;color:#ff453a;border-radius:4px;padding:2px 8px;margin:2px">${esc(k)}</span> <span style="font-size:10px;color:#8e8e93">${flagMap[k].sources.join("/")}</span>`).join(" ")}</div></div>`);
    if (clear.length) parts.push(`<div><span style="color:#30d158;font-weight:600">未命中</span><div style="margin-top:4px;font-size:12px;line-height:1.6">${clear.map((k) => `<span style="display:inline-block;background:#1a3a1a;color:#30d158;border-radius:4px;padding:2px 8px;margin:2px">${esc(k)}</span> <span style="font-size:10px;color:#8e8e93">${flagMap[k].sources.join("/")}</span>`).join(" ")}</div></div>`);
    return parts.join("");
}

function renderMediaSummary(media) {
    if (!media || !media.length) return mutedLine("流媒体检测已关闭");
    const confirmed = media.filter((r) => r.status !== "unknown");
    const unknown = media.filter((r) => r.status === "unknown");
    const body = confirmed.map((r) => {
        const st = mediaStatus(r.status);
        const icon = r.status === "yes" ? "✅" : r.status === "partial" ? "🟠" : "❌";
        const summary = `${st.text}${r.region ? ' [' + r.region + ']' : ''}`;
        const detail = r.detail ? `<div style="font-size:11px;color:#8e8e93;margin-top:1px">${esc(r.detail)}</div>` : "";
        return `<div style="margin-bottom:8px"><span>${icon}</span>&nbsp;<span style="font-weight:700">${esc(r.name)}</span>&nbsp;&nbsp;<span style="color:${st.color};font-weight:600">${esc(summary)}</span>${detail}</div>`;
    }).join("");
    const unknownLine = unknown.length ? mutedLine(`⚪ 未确认：${unknown.map((r) => r.name).join("、")}`) : "";
    return (body || mutedLine("未确认任何服务")) + unknownLine;
}

function renderAuditSummary(audit) {
    const summary = `来源 ${audit.success.length}/${audit.total}`;
    const missing = audit.failed.length ? mutedLine(`未返回 · ${audit.failed.join("、")}`) : mutedLine("全部已返回");
    return infoLine("状态", summary) + missing;
}

function mediaStatus(status) {
    if (status === "yes") return { text: "解锁", color: "#00a67d" };
    if (status === "partial") return { text: "部分可用", color: "#ff9500" };
    if (status === "no") return { text: "不可用", color: "#ff3b30" };
    return { text: "未确认", color: "#8e8e93" };
}

function esc(text) { return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function maskIPAddress(ip) { if (!maskIP || !ip) return ip; const t = String(ip); const p = t.split("."); if (p.length === 4) return `${p[0]}.${p[1]}.*.*`; const v6 = t.split(":"); return v6.length > 3 ? `${v6.slice(0, 4).join(":")}:*` : t; }
function infoLine(l, v) { return `<div style="margin-bottom:6px;line-height:1.4"><span style="color:#8e8e93;font-size:12px">${esc(l)}</span>&nbsp;&nbsp;<span style="font-weight:600">${esc(v)}</span></div>`; }
function mutedLine(v) { return `<div style="color:#8e8e93;font-size:11px;margin:5px 0;line-height:1.45">${esc(v)}</div>`; }
function browserHeaders() { return { Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "User-Agent": USER_AGENT }; }
function backendHeaders() { return { Accept: "application/json", "User-Agent": "curl/8.7.1" }; }

function requestJson(url, options) {
    const config = options || {};
    return request(config.method || "GET", url, config).then((r) => { try { return JSON.parse(r.body); } catch (_) { throw new Error("JSON 解析失败"); } });
}
function requestText(url, options) { const c = options || {}; return request(c.method || "GET", url, c).then((r) => r.body); }
function request(method, url, options) {
    const config = options || {};
    return new Promise((resolve, reject) => {
        const isBackend = String(url).indexOf(IPQUALITY_BACKEND) === 0;
        const opts = { url, node: cleanValue(config.node) || nodeName, headers: config.headers || (isBackend ? backendHeaders() : browserHeaders()) };
        if (isBackend) opts.alpn = "h2";
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

function readSwitch(key, def) { const v = $persistentStore.read(key); if (v === null || v === "" || typeof v === "undefined") return def; return !(v === false || v === 0 || v === "false" || v === "0"); }
function isIPv4(v) { const p = String(v || "").trim().split("."); return p.length === 4 && p.every((x) => /^\d{1,3}$/.test(x) && Number(x) >= 0 && Number(x) <= 255); }
function normalizeIPAddress(v) {
    const t = String(v || "").trim().toLowerCase();
    if (!t || !isIPv4(t) && !(/^[0-9a-f:]+$/i.test(t) && t.indexOf(":") >= 0)) return "";
    if (isIPv4(t)) return t;
    try { return new URL(`http://[${t}]/`).hostname.replace(/^\[|\]$/g, "").toLowerCase(); } catch (_) { return t; }
}
function cleanValue(v) { if (v === null || typeof v === "undefined") return ""; const t = String(v).trim(); if (!t || /^(null|undefined|n\/a|unknown|-)$/i.test(t)) return ""; return t; }
function cleanASN(v) { const c = cleanValue(v).replace(/^AS/i, ""); const m = c.match(/^\d+/); return m ? m[0] : ""; }
function numberOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function truncateText(v, m) { const t = String(v || ""); const l = Number(m) || 0; return l > 1 && t.length > l ? t.slice(0, l - 1) + "…" : t; }
function splitCoordinate(v, i) { const p = String(v || "").split(","); return p.length > i ? p[i] : null; }
function anyTrue(vals) { const n = vals.map(booleanOrNull); if (n.some((v) => v === true)) return true; if (n.length && n.every((v) => v === false)) return false; return null; }
function booleanOrNull(v) { if (v === true || v === "true" || v === 1 || v === "1") return true; if (v === false || v === "false" || v === 0 || v === "0") return false; return null; }
function valueAt(obj, path) { if (!obj) return null; const k = String(path).split("."); let v = obj; for (let i = 0; i < k.length; i++) { if (v === null || typeof v === "undefined") return null; v = v[k[i]]; } return v; }
function round(v, d) { const f = Math.pow(10, d); return Math.round(v * f) / f; }
function errorMessage(e) { return e && e.message ? e.message : String(e || "未知错误"); }
function flagEmoji(code) { const c = String(code || "").toUpperCase(); if (!/^[A-Z]{2}$/.test(c)) return ""; return String.fromCodePoint(c.codePointAt(0) - 65 + 0x1F1E6, c.codePointAt(1) - 65 + 0x1F1E6); }
function toDMS(v, lat) {
    const n = Number(v); if (!Number.isFinite(n)) return "";
    const a = Math.abs(n); let d = Math.floor(a); const mf = (a - d) * 60; let m = Math.floor(mf); let s = round((mf - m) * 60, 2);
    if (s >= 60) { s = 0; m += 1; } if (m >= 60) { m = 0; d += 1; }
    const dir = lat ? (n >= 0 ? "N" : "S") : (n >= 0 ? "E" : "W");
    return `${d}°${m}′${s}″${dir}`;
}
function buildMapURL(lat, lon, r) {
    let z = 15; const a = numberOrNull(r);
    if (a !== null && a > 1000) z = 12; else if (a !== null && a > 500) z = 13; else if (a !== null && a > 250) z = 14;
    return `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent("节点 IP 出口")}&z=${z}&t=m`;
}
function formatType(type) {
    const c = cleanValue(type); if (!c) return "未取到";
    const pm = { "DATA CENTER/WEB HOSTING/TRANSIT": "机房", "FIXED LINE ISP": "家宽", "MOBILE ISP": "手机", "CONTENT DELIVERY NETWORK": "CDN", "DATA CENTER/TRANSIT": "机房", "SEARCH ENGINE SPIDER": "搜索引擎", "UNIVERSITY/COLLEGE/SCHOOL": "教育" };
    if (pm[c.toUpperCase()]) return pm[c.toUpperCase()];
    const m = { DCH: "机房", WEB: "机房", SES: "搜索引擎", HOSTING: "机房", ISP: "家宽", RES: "住宅", RESIDENTIAL: "住宅", BUSINESS: "商业", COMMERCIAL: "商业", BANKING: "银行", COM: "商业", MOB: "手机", MOBILE: "手机", CDN: "CDN", EDU: "教育", MIL: "军队", MILITARY: "军队", LIB: "图书馆", LIBRARY: "图书馆", RSV: "保留", RESERVED: "保留", GOVERNMENT: "政府", GOV: "政府", ORG: "组织", ORGANIZATION: "组织" };
    const f = c.split("/")[0].trim().toUpperCase(); return m[f] || f;
}
function getIp2location(data) {
    const f = data && data.ip2locationFull;
    if (f && typeof f === "object" && (cleanValue(f.ip) || cleanValue(f.usage_type) || numberOrNull(f.fraud_score) !== null || f.proxy)) return f;
    return null;
}
function parseScamalyticsHtml(html, ip) {
    if (!html || /Attention Required|unable to access|cf-error-details/i.test(String(html))) return null;
    const t = String(html); const ti = normalizeIPAddress(ip);
    const ipP = ti ? new RegExp(`(^|[^0-9a-f:.])${escapeRegExp(ti)}([^0-9a-f:.]|$)`, "i") : null;
    if (!ipP || !/Scamalytics/i.test(t) || !ipP.test(t)) return null;
    const sc = t.match(/Fraud\s*Score\s*[:：]?\s*(?:<[^>]+>\s*){0,3}(\d{1,3})(?!\d)/i);
    if (!sc) return null; const sv = Number(sc[1]);
    if (!Number.isFinite(sv) || sv < 0 || sv > 100) return null;
    return { ip, scamalytics: { scamalytics_score: sv, scamalytics_proxy: { is_vpn: null, is_datacenter: null }, is_blacklisted_external: null }, _fallback: true };
}
function escapeRegExp(t) { return String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// 流媒体检测（保持原逻辑）
async function collectMedia() {
    const tests = [
        () => testTikTok(), () => testDisneyPlus(), () => testNetflix(),
        () => testYouTube(), () => testPrimeVideo(), () => testReddit(), () => testChatGPT(),
    ];
    const settled = await limitedConcurrency(tests, MAX_CONCURRENCY);
    const names = ["TikTok", "Disney+", "Netflix", "YouTube", "Prime Video", "Reddit", "ChatGPT"];
    return names.map((n, i) => {
        if (settled[i].ok) return settled[i].value;
        warn(`${n}: ${settled[i].error}`);
        return { name: n, status: "unknown", region: "", detail: "请求失败" };
    });
}

async function testTikTok() {
    const r = await request("GET", "https://www.tiktok.com/", { allowHttpErrors: true, headers: browserHeaders() });
    const region = firstMatch(r.body, [/\"region\"\s*:\s*\"([A-Z]{2})\"/i, /\"storeCountry\"\s*:\s*\"([A-Z]{2})\"/i]);
    if (region) return { name: "TikTok", status: "yes", region, detail: "页面地区" };
    if (r.status === 403 || /not available|access denied/i.test(r.body)) return { name: "TikTok", status: "no", region: "", detail: `HTTP ${r.status}` };
    return { name: "TikTok", status: "unknown", region: "", detail: "未识别" };
}
async function testDisneyPlus() {
    const d = await requestJson("https://disney.api.edge.bamgrid.com/devices", { method: "POST", headers: { Authorization: `Bearer ${DISNEY_CLIENT_TOKEN}`, "Content-Type": "application/json; charset=UTF-8", "User-Agent": USER_AGENT }, body: JSON.stringify({ deviceFamily: "browser", applicationRuntime: "chrome", deviceProfile: "windows", attributes: {} }) });
    if (!d.assertion) return { name: "Disney+", status: "unknown", region: "", detail: "设备注册失败" };
    const form = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange&latitude=0&longitude=0&platform=browser&subject_token=${encodeURIComponent(d.assertion)}&subject_token_type=urn%3Abamtech%3Aparams%3Aoauth%3Atoken-type%3Adevice`;
    const t = await requestJson("https://disney.api.edge.bamgrid.com/token", { method: "POST", allowHttpErrors: true, headers: { Authorization: `Bearer ${DISNEY_CLIENT_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT }, body: form });
    if (t.error_description === "forbidden-location") return { name: "Disney+", status: "no", region: "", detail: "地理位置受限" };
    const region = t.region || t.location || "";
    if (region) return { name: "Disney+", status: "yes", region: region.toUpperCase(), detail: "令牌地区" };
    return { name: "Disney+", status: "unknown", region: "", detail: "未识别" };
}
async function testNetflix() {
    const rs = await Promise.all([
        request("GET", "https://www.netflix.com/title/70143836", { allowHttpErrors: true }),
        request("GET", "https://www.netflix.com/title/80018499", { allowHttpErrors: true }),
        request("GET", "https://www.netflix.com/title/70143860", { allowHttpErrors: true }),
        request("GET", "https://www.netflix.com/title/70202589", { allowHttpErrors: true }),
    ]);
    const ua = rs.map((r) => /Oh no!|NSEZ-404/i.test(r.body));
    const avail = ua.filter((v) => !v).length;
    if (avail >= 2) { const reg = firstMatch(rs[0].body, [/\"countryOfManufacture\"\s*:\s*\"([A-Z]{2})\"/i, /\"locale\"\s*:\s*\"([a-z]{2})-?/i]); return { name: "Netflix", status: "yes", region: reg || "", detail: `可看 ${avail}/4` }; }
    if (avail > 0) return { name: "Netflix", status: "partial", region: "", detail: `可看 ${avail}/4` };
    return { name: "Netflix", status: "no", region: "", detail: "全部不可用" };
}
async function testYouTube() {
    const r = await request("GET", "https://www.youtube.com/premium", { allowHttpErrors: true, headers: browserHeaders() });
    if (/www\.google\.cn/i.test(r.body)) return { name: "YouTube", status: "no", region: "CN", detail: "跳转 google.cn" };
    const region = firstMatch(r.body, [/"contentRegion"\s*:\s*"([A-Z]{2})"/i]);
    if (/Premium is not available in your country/i.test(r.body)) return { name: "YouTube", status: "no", region: region || "", detail: "不支援 Premium" };
    if (region && /YouTube Premium/i.test(r.body)) return { name: "YouTube", status: "yes", region, detail: "页面地区" };
    return { name: "YouTube", status: "unknown", region: region || "", detail: "未识别" };
}
async function testPrimeVideo() {
    const r = await request("GET", "https://www.primevideo.com/", { allowHttpErrors: true, headers: browserHeaders() });
    const region = firstMatch(r.body, [/"currentTerritory"\s*:\s*"([A-Z]{2})"/i, /"defaultTerritory"\s*:\s*"([A-Z]{2})"/i]);
    if (region && !/not available in your location/i.test(r.body)) return { name: "Prime Video", status: "yes", region, detail: "页面地区" };
    if (r.status === 403 || /not available in your location/i.test(r.body)) return { name: "Prime Video", status: "no", region: "", detail: "地区不可用" };
    return { name: "Prime Video", status: "unknown", region: "", detail: "未识别" };
}
async function testReddit() {
    const r = await request("GET", "https://www.reddit.com/", { allowHttpErrors: true, headers: browserHeaders() });
    const region = firstMatch(r.body, [/"countryCode"\s*:\s*"([A-Z]{2})"/i, /"geo"\s*:\s*"([A-Z]{2})"/i]);
    if (region) return { name: "Reddit", status: "yes", region, detail: "页面地区" };
    return { name: "Reddit", status: "unknown", region: "", detail: "未识别" };
}
async function testChatGPT() {
    const trace = await request("GET", "https://chatgpt.com/cdn-cgi/trace", { allowHttpErrors: true }).catch(() => null);
    const region = trace ? firstMatch(trace.body, [/^loc=([A-Z]{2})$/im]) : "";
    if (region) return { name: "ChatGPT", status: "yes", region, detail: "CDN 地区" };
    return { name: "ChatGPT", status: "unknown", region: "", detail: "CDN 未识别" };
}
function firstMatch(text, patterns) { for (let i = 0; i < patterns.length; i++) { const m = String(text).match(patterns[i]); if (m) return m[1]; } return ""; }

function finishError(msg) {
    $done({ title: "\u200B", htmlMessage: `<div style="font-family:-apple-system,BlinkMacSystemFont;font-size:14px;text-align:center;padding:40px 20px;color:#ff3b30">${esc(msg)}</div>`, icon: "shield.lefthalf.filled", "title-color": "#ff3b30" });
}
function postMapNotification(basic, name) {
    if (!mapNotificationEnabled || !basic.lat || !basic.lon) return;
    try { $notification.post("节点 IP 位置", `节点 · ${name}`, buildMapURL(basic.lat, basic.lon, 0)); } catch (_) {}
}