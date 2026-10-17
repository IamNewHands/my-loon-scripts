/*
 * GitHubPro.js — Loon http-response script for https://api.github.com/graphql
 *
 * 作者：IamNewHands (https://github.com/IamNewHands) — 翻译、缓存与整体维护
 *       原作解锁逻辑：baby (https://github.com/Yu9191)
 *
 * 1) 保留原有解锁逻辑
 * 2) 新增翻译：README 正文 / issue・PR 正文与评论 / Release 说明
 *    模式：bilingual = 原文 + 译文；pure = 只显示译文
 *
 * 翻译由 Google 免费端点(gtx)完成，无需任何密钥。
 * 代码块 <pre>/<code>、SVG 图标、链接地址由端点原样保留，不会被翻译。
 */
(function () {
  'use strict';

  /* ============================ 参数 ============================ */
  var ARG_KEYS = ['Enable', 'Mode', 'TargetLang', 'TranslateReadme', 'TranslateIssue', 'TranslateRelease', 'Debug', 'ClearCache', 'TitleFormat'];
  var DEFAULTS = {
    Enable: true, Mode: 'bilingual', TargetLang: 'zh-CN',
    TranslateReadme: true, TranslateIssue: true, TranslateRelease: false, Debug: false, ClearCache: false, TitleFormat: 'html'
  };

  function argRaw(name) {
    var a = (typeof $argument === 'undefined') ? null : $argument;
    if (a === null || a === undefined) return undefined;
    if (Object.prototype.toString.call(a) === '[object Array]') {
      var i = ARG_KEYS.indexOf(name);
      return (i >= 0) ? a[i] : undefined;
    }
    if (typeof a === 'object') return a[name];
    return undefined;
  }
  function toBool(v, def) {
    if (v === undefined || v === null || v === '') return def;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    return !/^(false|0|off|no)$/i.test(String(v).trim());
  }

  var CFG = {
    enable: toBool(argRaw('Enable'), DEFAULTS.Enable),
    mode: String(argRaw('Mode') === undefined ? DEFAULTS.Mode : argRaw('Mode')).toLowerCase() === 'pure' ? 'pure' : 'bilingual',
    lang: String(argRaw('TargetLang') === undefined ? DEFAULTS.TargetLang : argRaw('TargetLang')) || 'zh-CN',
    readme: toBool(argRaw('TranslateReadme'), DEFAULTS.TranslateReadme),
    issue: toBool(argRaw('TranslateIssue'), DEFAULTS.TranslateIssue),
    release: toBool(argRaw('TranslateRelease'), DEFAULTS.TranslateRelease),
    debug: toBool(argRaw('Debug'), DEFAULTS.Debug),
    clearCache: toBool(argRaw('ClearCache'), DEFAULTS.ClearCache),
    titleFormat: String(argRaw('TitleFormat') === undefined ? DEFAULTS.TitleFormat : argRaw('TitleFormat')).toLowerCase() === 'text' ? 'text' : 'html'
  };

  function log() {
    if (!CFG.debug) return;
    var a = ['[GitHubPro]'];
    for (var i = 0; i < arguments.length; i++) a.push(arguments[i]);
    try { console.log(a.join(' ')); } catch (e) {}
  }
  function warn() {
    var a = ['[GitHubPro]'];
    for (var i = 0; i < arguments.length; i++) a.push(arguments[i]);
    try { console.log(a.join(' ')); } catch (e) {}
  }

  /* ============================ 常量 ============================ */
  var HTML_KEYS = { contentHTML: 1, bodyHTML: 1, descriptionHTML: 1 };
  // 字段归类：name/url 等标识性字段一律不碰
  function classify(key, path) {
    if (key === 'contentHTML') return 'readme';
    if (key === 'bodyHTML') return 'issue';
    if (key === 'descriptionHTML' || key === 'description') {
      return /release/i.test(path) ? 'release' : 'readme';   // 仓库简介 vs Release 说明
    }
    if (key === 'title' || key === 'issueHtmlTitle' || key === 'pullRequestHtmlTitle') return 'issue';
    return null;
  }
  var BLOCK_TAG = { p: 1, li: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, td: 1, th: 1, blockquote: 1, summary: 1, dt: 1, dd: 1 };
  var VOID_TAG = /^(br|hr|img|input|meta|link|source|wbr|area|base|col|embed|param|track)$/;
  var OPAQUE_TAG = /^(pre|code|svg|script|style|textarea|math)$/;
  var UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  var MIN_TEXT = 12;      // 可见文字少于该长度的块不翻（纯链接/图片/提交号等噪声）
  var TEXT_MIN = 4;       // 纯文本字段（标题/说明）最短长度
  var HTTP_TIMEOUT_MS = 8000; // Loon 的 $httpClient timeout 单位是毫秒
  var MAX_Q = 4000;       // 单次翻译请求的源文长度上限
  var DEADLINE_MS = 9000; // 超时降级：到点直接返回原文
  var CACHE_MAX = 300;                    // 缓存条目上限（按字段计：README=1 条、标题=1 条/条）
  var CACHE_BYTES_MAX = 2 * 1024 * 1024;  // 缓存总字节上限 2MB
  // 译文样式：正文块跟随原文大小（1em），标题块固定 15px 避免继承标题的巨大字号
  var STYLE_BODY = 'display:block;border-left:3px solid #d0d7de;padding-left:8px;margin:6px 0 0;color:#57606a;font-size:1em;font-weight:400;line-height:1.65';
  var STYLE_HEAD = 'display:block;border-left:3px solid #d0d7de;padding-left:8px;margin:6px 0 0;color:#57606a;font-size:15px;font-weight:400;line-height:1.65';
  function blockStyle(tag) { return /^h[1-6]$/.test(tag || '') ? STYLE_HEAD : STYLE_BODY; }
  // 标题/简介这类纯文本字段的双语拼接（无法插入块级元素）
  var TITLE_INLINE_STYLE = 'font-size:0.85em;font-weight:400;color:#57606a';
  function joinTitle(src, dst) {
    if (CFG.titleFormat === 'text') return src + '\n译：' + dst;   // 兜底：换行 + 标记，任何渲染器都能看出哪句是译文
    return src + '<br><span style="' + TITLE_INLINE_STYLE + '">' + dst + '</span>';
  }

  /* ============================ 工具 ============================ */
  function hash(s) {
    var h = 5381, i = s.length;
    while (i) h = (h * 33) ^ s.charCodeAt(--i);
    return (h >>> 0).toString(36);
  }
  function isZhTarget() { return /^zh/i.test(CFG.lang); }
  function cjkRatio(s) {
    var m = s.match(/[\u3400-\u9fff\uf900-\ufaff]/g);
    var letters = s.replace(/<[^>]*>/g, '').replace(/[^A-Za-z\u3400-\u9fff]/g, '');
    if (!letters.length) return 0;
    return (m ? m.length : 0) / letters.length;
  }
  function storeRead(k) { try { return $persistentStore.read(k) || null; } catch (e) { return null; } }
  function storeWrite(k, v) { try { $persistentStore.write(v, k); return true; } catch (e) { return false; } }
  function storeDel(k) { try { $persistentStore.write(undefined, k); } catch (e) {} }
  function cacheKey(area, body) { return 'ghpro_' + CFG.mode + '_' + CFG.lang + '_' + area + '_' + hash(body); }

  // 粗估字节数：非 ASCII 字符按 3 字节计（用于字节上限）
  function roughBytes(s) {
    var nonAscii = s.match(/[^\x00-\x7f]/g);
    return s.length + (nonAscii ? nonAscii.length * 2 : 0);
  }
  function readIndex() {
    var idx;
    try { idx = JSON.parse(storeRead('ghpro_index') || '[]') || []; } catch (e) { idx = []; }
    var out = [];
    for (var i = 0; i < idx.length; i++) {
      var e = idx[i];
      if (typeof e === 'string') out.push({ k: e, b: 0 });          // 兼容旧版索引
      else if (e && e.k) out.push({ k: e.k, b: e.b || 0 });
    }
    return out;
  }
  function writeIndex(idx) { storeWrite('ghpro_index', JSON.stringify(idx)); }

  function cacheGet(k) {
    var v = storeRead(k);
    if (!v) return null;
    var idx = readIndex();                                          // 命中即提到队首 → 真 LRU
    if (!idx.length || idx[0].k !== k) {
      var out = [{ k: k, b: roughBytes(v) }];
      for (var i = 0; i < idx.length && out.length < CACHE_MAX; i++) if (idx[i].k !== k) out.push(idx[i]);
      writeIndex(out);
    }
    return v;
  }
  function cachePut(k, v) {
    if (!storeWrite(k, v)) return;
    var idx = readIndex(), keep = [], count = 0, bytes = 0;
    var head = [{ k: k, b: roughBytes(v) }];
    for (var i = 0; i < idx.length; i++) if (idx[i].k !== k) head.push(idx[i]);
    for (var j = 0; j < head.length; j++) {
      var e = head[j];
      if (count >= CACHE_MAX || bytes + e.b > CACHE_BYTES_MAX) { storeDel(e.k); continue; }  // 淘汰队尾
      keep.push(e); count++; bytes += e.b;
    }
    writeIndex(keep);
  }
  function cacheClear() {
    var idx = readIndex();
    for (var i = 0; i < idx.length; i++) storeDel(idx[i].k);
    writeIndex([]);
    return idx.length;
  }

  /* ==================== HTML 分块（双语插入点） ==================== */
  // 返回 [{innerStart, innerEnd}]：块级元素的「内部区间」，双语译文插到 innerEnd 之前。
  function tagScan(html) {
    var re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
    var stack = [], cands = [], m, depth = 0;
    while ((m = re.exec(html)) !== null) {
      var closing = m[1] === '/', tag = m[2].toLowerCase(), attrs = m[3] || '';
      if (m[4] === '/' || VOID_TAG.test(tag)) continue;
      if (OPAQUE_TAG.test(tag)) { depth += closing ? -1 : 1; if (depth < 0) depth = 0; continue; }
      if (depth > 0) continue;
      if (!closing) {
        var isBlock = !!BLOCK_TAG[tag] || (tag === 'div' && /class\s*=\s*"[^"]*markdown-heading/.test(attrs));
        stack.push({ tag: tag, start: m.index, innerStart: re.lastIndex, isBlock: isBlock });
      } else {
        var k = stack.length - 1;
        while (k >= 0 && stack[k].tag !== tag) k--;
        if (k < 0) continue;
        var fr = stack[k];
        stack.length = k;
        if (fr.isBlock) cands.push({ start: fr.start, innerStart: fr.innerStart, innerEnd: m.index, end: re.lastIndex, tag: tag });
      }
    }
    return cands;
  }

  function plainText(s) { return s.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }

  function directTextLen(html, blk, all) {
    var inner = [];
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      if (b !== blk && b.start >= blk.innerStart && b.end <= blk.innerEnd) inner.push(b);
    }
    inner.sort(function (a, b) { return a.start - b.start; });
    var txt = '', pos = blk.innerStart;
    for (var j = 0; j < inner.length; j++) { txt += html.slice(pos, inner[j].start); pos = inner[j].end; }
    txt += html.slice(pos, blk.innerEnd);
    return plainText(txt).length;
  }

  // 选出「叶子块」：外层块自身文本太少(<8 字)时让位给内层块，否则吞掉内层块
  function selectBlocks(html) {
    var all = tagScan(html);
    if (!all.length) return [];
    var drop = [];
    for (var i = 0; i < all.length; i++) {
      var a = all[i], hasNested = false;
      for (var j = 0; j < all.length; j++) {
        var b = all[j];
        if (b !== a && b.start >= a.innerStart && b.end <= a.innerEnd) { hasNested = true; break; }
      }
      if (hasNested && directTextLen(html, a, all) < 8) drop.push(a);
    }
    var keep = [];
    for (var x = 0; x < all.length; x++) {
      var c = all[x], skip = false;
      for (var d = 0; d < drop.length; d++) if (drop[d] === c) { skip = true; break; }
      if (skip) continue;
      if (plainText(html.slice(c.innerStart, c.innerEnd)).length < MIN_TEXT) continue; // 噪声块
      var inside = false;
      for (var e = 0; e < keep.length; e++) {
        if (c.start >= keep[e].innerStart && c.end <= keep[e].innerEnd) { inside = true; break; }
      }
      if (!inside) keep.push(c);
    }
    keep.sort(function (a, b) { return a.innerStart - b.innerStart; });
    return keep;
  }

  /* ============================ 翻译 ============================ */
  function gtx(segs, cb) {
    var q = segs.join('\r');
    var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
      encodeURIComponent(CFG.lang) + '&dt=t&q=' + encodeURIComponent(q);
    $httpClient.get({ url: url, headers: { 'User-Agent': UA }, timeout: HTTP_TIMEOUT_MS }, function (err, resp, data) {
      if (err) return cb(err);
      try {
        var j = JSON.parse(data), joined = '';
        if (Object.prototype.toString.call(j) === '[object Array]' && Object.prototype.toString.call(j[0]) === '[object Array]') {
          for (var i = 0; i < j[0].length; i++) if (j[0][i] && j[0][i][0]) joined += j[0][i][0];
        } else if (j && j.sentences) {
          for (var s = 0; s < j.sentences.length; s++) joined += j.sentences[s].trans;
        } else { return cb(new Error('unexpected payload')); }
        var out = joined.split('\r');
        if (out.length !== segs.length) return cb(new Error('segment mismatch ' + out.length + '/' + segs.length));
        cb(null, out);
      } catch (e) { cb(e); }
    });
  }

  function translateAll(segs, cb) {
    var groups = [], cur = [], curLen = 0;
    for (var i = 0; i < segs.length; i++) {
      var len = segs[i].length + 1;
      if (cur.length && curLen + len > MAX_Q) { groups.push(cur); cur = []; curLen = 0; }
      cur.push(segs[i]); curLen += len;
    }
    if (cur.length) groups.push(cur);
    if (!groups.length) return cb(null, segs);

    var result = new Array(segs.length), offset = 0, pending = groups.length, failed = false;
    for (var g = 0; g < groups.length; g++) {
      (function (group, base) {
        gtx(group, function (err, out) {
          if (!failed) {
            if (err || !out) { failed = true; warn('翻译失败，本次返回原文：', err && err.message); }
            else for (var k = 0; k < out.length; k++) result[base + k] = out[k];
          }
          if (--pending === 0) cb(null, failed ? null : result);
        });
      })(groups[g], offset);
      offset += groups[g].length;
    }
  }

  /* ============================ 字段处理 ============================ */
  function areaEnabled(area) {
    if (area === 'readme') return CFG.readme;
    if (area === 'issue') return CFG.issue;
    if (area === 'release') return CFG.release;
    return false;
  }
  function acceptable(v) {
    if (!v || v.length < 12) return false;
    if (!/<[a-z][^>]*>/i.test(v)) return false;
    if (!/[A-Za-z]/.test(v)) return false;
    if (plainText(v).length < 24) return false;          // 内容太少不值得翻
    if (isZhTarget() && cjkRatio(v) > 0.35) return false; // 本来就是中文，跳过
    return true;
  }
  function acceptableText(v) {
    if (!v || v.length < TEXT_MIN) return false;
    if (!/[A-Za-z]/.test(v)) return false;
    if (isZhTarget() && cjkRatio(v) > 0.35) return false;
    return true;
  }
  function collect(node, out, depth, path) {
    if (!node || depth > 14) return;
    if (Object.prototype.toString.call(node) === '[object Array]') {
      for (var i = 0; i < node.length; i++) collect(node[i], out, depth, path);
      return;
    }
    if (typeof node !== 'object') return;
    for (var k in node) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
      var v = node[k];
      if (typeof v === 'string') {
        var area = classify(k, path);
        if (!area || !areaEnabled(area)) continue;
        var isHtml = !!HTML_KEYS[k];
        if (isHtml ? acceptable(v) : acceptableText(v)) {
          out.push({ parent: node, key: k, area: area, kind: isHtml ? 'html' : 'text', src: v });
        }
      } else if (v && typeof v === 'object') {
        collect(v, out, depth + 1, path + '.' + k);
      }
    }
  }

  /* ============================ 主流程 ============================ */
  var finished = false;
  function finish(bodyStr) {
    if (finished) return;
    finished = true;
    if (bodyStr === null || bodyStr === undefined) $done({}); else $done({ body: bodyStr });
  }

  function main() {
    if (!$response || typeof $response.body !== 'string') return finish(null);

    var obj;
    try { obj = JSON.parse($response.body); } catch (e) { return finish(null); }

    // --- 原有解锁逻辑 ---
    var unlocked = false;
    try {
      if (obj && obj.data && obj.data.viewer) {
        obj.data.viewer.isProPlan = true;
        obj.data.viewer.isEmployee = true;
        obj.data.viewer.hasAppleIapSubscription = true;
        unlocked = true;
      }
    } catch (e) {}
    var unlockBody = unlocked ? JSON.stringify(obj) : null;

    if (!CFG.enable) return finish(unlockBody);
    if (CFG.clearCache) warn('ClearCache 已开启，清空缓存 ' + cacheClear() + ' 条（请用完后手动关掉）');
    if (!$httpClient || (!$request)) return finish(unlockBody);

    // --- 收集待翻译字段 ---
    var fields = [];
    collect(obj, fields, 0, '$');
    if (!fields.length) return finish(unlockBody);
    if (CFG.debug) {
      var names = [];
      for (var q0 = 0; q0 < fields.length; q0++) names.push(fields[q0].key + '(' + fields[q0].kind + ',' + fields[q0].src.length + ')');
      log('collected: ' + names.join(' '));
    }

    // --- 缓存命中 + 切块 ---
    var todo = [];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i], ck = cacheKey(f.area, f.kind + '|' + f.src), hit = cacheGet(ck);
      if (hit) { f.parent[f.key] = hit; log('cache hit', f.area, f.key); continue; }
      f.units = [];
      if (f.kind === 'html') {
        var blocks = selectBlocks(f.src);
        for (var b = 0; b < blocks.length; b++) {
          f.units.push({
            start: blocks[b].innerStart, end: blocks[b].innerEnd, tag: blocks[b].tag,
            text: f.src.slice(blocks[b].innerStart, blocks[b].innerEnd).replace(/\r/g, ' ')
          });
        }
        // 兜底：整段就是一个不带块级标签的容器（如仓库简介 "<div>…</div>"）
        if (!f.units.length && plainText(f.src).length >= 8) {
          f.units.push({ start: 0, end: f.src.length, tag: '', text: plainText(f.src).replace(/\r/g, ' ') });
        }
      } else {
        f.units.push({ text: f.src.replace(/\r/g, ' ') });
      }
      if (f.units.length) { f.cacheKey = ck; todo.push(f); }
    }
    if (!todo.length) {
      var cachedBody = JSON.stringify(obj);
      return finish(cachedBody === $response.body ? unlockBody : cachedBody);
    }

    // --- 汇总片段并去重（相同文本只翻一次，标题类字段重复率高）---
    var uniq = [], index = {};
    for (var t = 0; t < todo.length; t++) {
      for (var u = 0; u < todo[t].units.length; u++) {
        var txt = todo[t].units[u].text;
        if (!Object.prototype.hasOwnProperty.call(index, txt)) { index[txt] = uniq.length; uniq.push(txt); }
      }
    }
    log('fields=' + todo.length, 'segments=' + uniq.length, 'mode=' + CFG.mode, 'lang=' + CFG.lang);

    var guard = setTimeout(function () { warn('翻译超时，本次返回原文'); finish(unlockBody); }, DEADLINE_MS);

    translateAll(uniq, function (err, out) {
      clearTimeout(guard);
      if (err || !out) return finish(unlockBody);

      for (var a = 0; a < todo.length; a++) {
        var fld = todo[a];
        if (fld.kind === 'text') {
          var dst = out[index[fld.units[0].text]] || '';
          if (!dst) continue;
          fld.parent[fld.key] = (CFG.mode === 'pure') ? dst : joinTitle(fld.src, dst);
          if (fld.cacheKey) cachePut(fld.cacheKey, fld.parent[fld.key]);
          continue;
        }
        var html = fld.src, units = fld.units.slice();
        units.sort(function (x, y) { return y.end - x.end; }); // 从后往前替换，偏移不失效
        for (var r = 0; r < units.length; r++) {
          var un = units[r], tr = out[index[un.text]];
          if (!tr || !tr.length) continue;
          if (CFG.mode === 'pure') {
            html = html.slice(0, un.start) + tr + html.slice(un.end);
          } else {
            html = html.slice(0, un.end) + '<span style="' + blockStyle(un.tag) + '">' + tr + '</span>' + html.slice(un.end);
          }
        }
        fld.parent[fld.key] = html;
        if (fld.cacheKey) cachePut(fld.cacheKey, html);
      }
      finish(JSON.stringify(obj));
    });
  }

  try { main(); } catch (e) { log('fatal', e && e.message); finish(null); }
})();
