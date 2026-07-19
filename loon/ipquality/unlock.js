/**
 * 节点解锁查询
 * 参考: https://github.com/KOP-XIAO/QuantumultX
 * 检测: Netflix / Disney+ / YouTube / ChatGPT / TikTok
 * 
 * [Script]
 * generic script-path=https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/ipquality/unlock.js, tag=节点解锁查询, timeout=20, img-url=play.circle.system, enable=true
 */

const NF_BASE_URL = "https://www.netflix.com/title/81280792";
const DISNEY_LOCATION_BASE_URL = 'https://disney.api.edge.bamgrid.com/graph/v1/device/graphql';
const YTB_BASE_URL = "https://www.youtube.com/premium";
const GPT_BASE_URL = 'https://chat.openai.com/';
const GPT_RegionL_URL = 'https://chat.openai.com/cdn-cgi/trace';

var inputParams = $environment.params;
var nodeName = inputParams.node;

let flags = new Map([["AC","🇦🇨"],["AE","🇦🇪"],["AF","🇦🇫"],["AI","🇦🇮"],["AL","🇦🇱"],["AM","🇦🇲"],["AQ","🇦🇶"],["AR","🇦🇷"],["AS","🇦🇸"],["AT","🇦🇹"],["AU","🇦🇺"],["AW","🇦🇼"],["AX","🇦🇽"],["AZ","🇦🇿"],["BA","🇧🇦"],["BB","🇧🇧"],["BD","🇧🇩"],["BE","🇧🇪"],["BF","🇧🇫"],["BG","🇧🇬"],["BH","🇧🇭"],["BI","🇧🇮"],["BJ","🇧🇯"],["BM","🇧🇲"],["BN","🇧🇳"],["BO","🇧🇴"],["BR","🇧🇷"],["BS","🇧🇸"],["BT","🇧🇹"],["BV","🇧🇻"],["BW","🇧🇼"],["BY","🇧🇾"],["BZ","🇧🇿"],["CA","🇨🇦"],["CF","🇨🇫"],["CH","🇨🇭"],["CK","🇨🇰"],["CL","🇨🇱"],["CM","🇨🇲"],["CN","🇨🇳"],["CO","🇨🇴"],["CP","🇨🇵"],["CR","🇨🇷"],["CU","🇨🇺"],["CV","🇨🇻"],["CW","🇨🇼"],["CX","🇨🇽"],["CY","🇨🇾"],["CZ","🇨🇿"],["DE","🇩🇪"],["DG","🇩🇬"],["DJ","🇩🇯"],["DK","🇩🇰"],["DM","🇩🇲"],["DO","🇩🇴"],["DZ","🇩🇿"],["EA","🇪🇦"],["EC","🇪🇨"],["EE","🇪🇪"],["EG","🇪🇬"],["EH","🇪🇭"],["ER","🇪🇷"],["ES","🇪🇸"],["ET","🇪🇹"],["EU","🇪🇺"],["FI","🇫🇮"],["FJ","🇫🇯"],["FK","🇫🇰"],["FM","🇫🇲"],["FO","🇫🇴"],["FR","🇫🇷"],["GA","🇬🇦"],["GB","🇬🇧"],["HK","🇭🇰"],["HU","🇭🇺"],["ID","🇮🇩"],["IE","🇮🇪"],["IL","🇮🇱"],["IM","🇮🇲"],["IN","🇮🇳"],["IS","🇮🇸"],["IT","🇮🇹"],["JP","🇯🇵"],["KR","🇰🇷"],["LU","🇱🇺"],["MO","🇲🇴"],["MX","🇲🇽"],["MY","🇲🇾"],["NL","🇳🇱"],["PH","🇵🇭"],["RO","🇷🇴"],["RS","🇷🇸"],["RU","🇷🇺"],["RW","🇷🇼"],["SA","🇸🇦"],["SB","🇸🇧"],["SC","🇸🇨"],["SD","🇸🇩"],["SE","🇸🇪"],["SG","🇸🇬"],["TH","🇹🇭"],["TN","🇹🇳"],["TO","🇹🇴"],["TR","🇹🇷"],["TV","🇹🇻"],["TW","🇨🇳"],["UK","🇬🇧"],["UM","🇺🇲"],["US","🇺🇸"],["UY","🇺🇾"],["UZ","🇺🇿"],["VA","🇻🇦"],["VE","🇻🇪"],["VG","🇻🇬"],["VI","🇻🇮"],["VN","🇻🇳"],["ZA","🇿🇦"]]);
support_countryCodes=["T1","XX","AL","DZ","AD","AO","AG","AR","AM","AU","AT","AZ","BS","BD","BB","BE","BZ","BJ","BT","BA","BW","BR","BG","BF","CV","CA","CL","CO","KM","CR","HR","CY","DK","DJ","DM","DO","EC","SV","EE","FJ","FI","FR","GA","GM","GE","DE","GH","GR","GD","GT","GN","GW","GY","HT","HN","HU","IS","IN","ID","IQ","IE","IL","IT","JM","JP","JO","KZ","KE","KI","KW","KG","LV","LB","LS","LR","LI","LT","LU","MG","MW","MY","MV","ML","MT","MH","MR","MU","MX","MC","MN","ME","MA","MZ","MM","NA","NR","NP","NL","NZ","NI","NE","NG","MK","NO","OM","PK","PW","PA","PG","PE","PH","PL","PT","QA","RO","RW","KN","LC","VC","WS","SM","ST","SN","RS","SC","SL","SG","SK","SI","SB","ZA","ES","LK","SR","SE","CH","TH","TG","TO","TT","TN","TR","TV","UG","AE","US","UY","VU","ZM","BO","BN","CG","CZ","VA","FM","MD","PS","KR","TW","TZ","TL","GB"];

let result = {
    "title": "节点解锁查询",
    "YouTube": '<b>YouTube: </b>检测失败 ❗️',
    "Netflix": '<b>Netflix: </b>检测失败 ❗️',
    "Disney": "<b>Disney+: </b>检测失败 ❗️",
    "ChatGPT": "<b>ChatGPT: </b>检测失败 ❗️",
    "TikTok": "<b>TikTok: </b>检测失败 ❗️",
}

let arrow = " ➟ ";

Promise.all([ytbTest(), disneyLocation(), nfTest(), gptTest(), tiktokTest()]).then(value => {
    let content = "------------------------------------</br>"+[result["Disney"], result["Netflix"], result["YouTube"], result["ChatGPT"], result["TikTok"]].join("</br></br>")
    content = content + "</br>------------------------------------</br>"+"<font color=#CD5C5C>"+"<b>节点</b> ➟ " + nodeName+ "</font>"
    content = `<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">` + content + `</p>`
    $done({"title":result["title"],"htmlMessage":content})
}).catch (values => {
    let content = "------------------------------------</br>"+[result["Disney"], result["Netflix"], result["YouTube"], result["ChatGPT"], result["TikTok"]].join("</br></br>")
    content = content + "</br>------------------------------------</br>"+"<font color=#CD5C5C>"+"<b>节点</b> ➟ " + nodeName+ "</font>"
    content = `<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">` + content + `</p>`
    $done({"title":result["title"],"htmlMessage":content})
})

function disneyLocation() {
    return new Promise((resolve, reject) => {
        let params = {
            url: DISNEY_LOCATION_BASE_URL,
            node: nodeName,
            timeout: 5000,
            headers: {
                'Accept-Language': 'en',
                "Authorization": 'ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            body: JSON.stringify({
                query: 'mutation registerDevice($input: RegisterDeviceInput!) { registerDevice(registerDevice: $input) { grant { grantType assertion } } }',
                variables: { input: { applicationRuntime: 'chrome', attributes: { browserName: 'chrome', browserVersion: '94.0.4606', manufacturer: 'microsoft', model: null, operatingSystem: 'windows', operatingSystemVersion: '10.0', osDeviceIds: [] }, deviceFamily: 'browser', deviceLanguage: 'en', deviceProfile: 'windows' } }
            }),
        }
        $httpClient.post(params, (errormsg, response, data) => {
            if (errormsg) { result["Disney"] = "<b>Disney+:</b>检测失败 ❗️"; resolve(); return; }
            if (response.status == 200) {
                let resData = JSON.parse(data);
                if (resData && resData.extensions && resData.extensions.sdk && resData.extensions.sdk.session) {
                    let s = resData.extensions.sdk.session;
                    if (s.inSupportedLocation == false) {
                        result["Disney"] = "<b>Disney+:</b> 即将登陆 ➟ "+'⟦'+(flags.get((s.location.countryCode||"").toUpperCase())||"")+"⟧ ⚠️";
                    } else {
                        result["Disney"] = "<b>Disney+:</b> 支持 ➟ "+'⟦'+(flags.get((s.location.countryCode||"").toUpperCase())||"")+"⟧ 🎉";
                    }
                } else {
                    result["Disney"] = "<b>Disney+:</b> 未支持 🚫";
                }
            } else {
                result["Disney"] = "<b>Disney+:</b>检测失败 ❗️";
            }
            resolve();
        })
    })
}

function ytbTest() {
    return new Promise((resolve, reject) => {
        let params = { url: YTB_BASE_URL, node: nodeName, timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36' } }
        $httpClient.get(params, (errormsg, response, data) => {
            if (errormsg) { result["YouTube"] = "<b>YouTube: </b>检测失败 ❗️"; resolve(errormsg); return; }
            if (response.status !== 200) { result["YouTube"] = "<b>YouTube: </b>检测失败 ❗️"; resolve(); return; }
            if (data.indexOf('Premium is not available in your country') !== -1) {
                result["YouTube"] = "<b>YouTube: </b>未支持 🚫";
            } else {
                let region = '';
                let re = new RegExp('"GL":"(.*?)"', 'gm');
                let ret = re.exec(data);
                if (ret && ret.length === 2) region = ret[1];
                else if (data.indexOf('www.google.cn') !== -1) region = 'CN';
                else region = 'US';
                result["YouTube"] = "<b>YouTube: </b>支持 "+arrow+ "⟦"+(flags.get(region.toUpperCase())||"")+"⟧ 🎉";
            }
            resolve();
        })
    })
}

function nfTest() {
    return new Promise((resolve, reject) => {
        let params = { url: NF_BASE_URL, node: nodeName, timeout: 6000, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15' } }
        $httpClient.get(params, (errormsg, response, data) => {
            if (errormsg) { result["Netflix"] = "<b>Netflix: </b>检测失败 ❗️"; resolve(); return; }
            if (response.status == 403) { result["Netflix"] = "<b>Netflix: </b>未支持 🚫"; resolve(); }
            else if (response.status == 404) { result["Netflix"] = "<b>Netflix: </b>支持自制剧集 ⚠️"; resolve(); }
            else if (response.status == 200) {
                let ourl = response.headers['X-Originating-URL'] || response.headers['X-Originating-Url'] || response.headers['x-originating-url'];
                if (ourl) {
                    let region = ourl.split('/')[3].split('-')[0];
                    if (region == 'title') region = 'us';
                    result["Netflix"] = "<b>Netflix: </b>完整支持"+arrow+ "⟦"+(flags.get(region.toUpperCase())||"")+"⟧ 🎉";
                } else {
                    result["Netflix"] = "<b>Netflix: </b>完整支持 🎉";
                }
            } else {
                result["Netflix"] = "<b>Netflix: </b>检测失败 ❗️";
            }
            resolve();
        })
    })
}

function gptTest() {
    return new Promise((resolve, reject) => {
        let params = { url: GPT_BASE_URL, node: nodeName, timeout: 5000, 'auto-redirect': false }
        $httpClient.get(params, (errormsg, response, data) => {
            if (errormsg) { result["ChatGPT"] = "<b>ChatGPT: </b>未支持 🚫"; resolve(); return; }
            let resp = JSON.stringify(response);
            let jdg = resp.indexOf("text/plain");
            if (jdg == -1) {
                let p = { url: GPT_RegionL_URL, node: nodeName, timeout: 5000 }
                $httpClient.get(p, (emsg, resheader, resData) => {
                    if (emsg) { result["ChatGPT"] = "<b>ChatGPT: </b>检测失败 ❗️"; resolve(); return; }
                    let region = resData.split("loc=")[1] ? resData.split("loc=")[1].split("\n")[0] : "";
                    let res = support_countryCodes.indexOf(region);
                    if (res != -1) {
                        result["ChatGPT"] = "<b>ChatGPT: </b>支持 "+arrow+ "⟦"+(flags.get(region.toUpperCase())||"")+"⟧ 🎉";
                    } else {
                        result["ChatGPT"] = "<b>ChatGPT: </b>未支持 🚫";
                    }
                    resolve();
                })
            } else {
                result["ChatGPT"] = "<b>ChatGPT: </b>未支持 🚫";
                resolve();
            }
        })
    })
}

function tiktokTest() {
    return new Promise((resolve, reject) => {
        let params = { url: "https://www.tiktok.com/", node: nodeName, timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } }
        $httpClient.get(params, (errormsg, response, data) => {
            if (errormsg) { result["TikTok"] = "<b>TikTok: </b>检测失败 ❗️"; resolve(); return; }
            let region = data ? data.match(/"region"\s*:\s*"([A-Z]{2})"/i) : null;
            if (region) {
                result["TikTok"] = "<b>TikTok: </b>支持 "+arrow+ "⟦"+(flags.get(region[1].toUpperCase())||"")+"⟧ 🎉";
            } else if (response.status == 403 || (data && data.indexOf('not available') != -1)) {
                result["TikTok"] = "<b>TikTok: </b>未支持 🚫";
            } else {
                result["TikTok"] = "<b>TikTok: </b>可访问 ⚠️";
            }
            resolve();
        })
    })
}