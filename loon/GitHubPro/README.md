# GitHubPro（Loon 插件）

GitHub iOS 客户端（App Store id 1477376905）增强：**解锁订阅** + **README / issue・PR / Release 的标题与正文翻译**。

## 作者

| 角色 | 作者 |
|---|---|
| 翻译功能、缓存与整体维护 | **[IamNewHands](https://github.com/IamNewHands)** |
| 原作解锁脚本（`viewer` 订阅字段改写） | [baby](https://github.com/Yu9191) |

- 翻译实现：拦截 `api.github.com/graphql` 响应，把 HTML/纯文本字段送 Google 免费端点（gtx）翻译后回填，**无需任何密钥**。代码块 `<pre>/<code>`、SVG 图标、链接地址不会被翻译。

## 安装

```
https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/GitHubPro/GitHubPro.plugin
```

需要开启 MitM（插件已声明 `hostname = api.github.com`）。

## 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| Enable | true | 关掉后只保留原有解锁功能 |
| Mode | bilingual | `bilingual` 原文+译文并列；`pure` 只显示译文 |
| TargetLang | zh-CN | 译文目标语言（zh-CN / zh-TW / en / ja） |
| TranslateReadme | true | 仓库首页 README 正文 + 仓库简介 |
| TranslateIssue | true | issue/PR 详情正文与评论、issue/PR 列表与详情**标题** |
| TranslateRelease | false | Release 说明 |
| Debug | false | 在 Loon 脚本日志输出执行信息 |
| ClearCache | false | 打开后每次运行先清空缓存（临时停用缓存），用完手动关掉 |
| TitleFormat | line | `line`＝硬换行 + 「译：」前缀（默认）；`html`＝译文另起一行且字号 0.85em（若标题里出现尖括号标签就切回 line） |

译文以带左侧灰条的块跟在原文段落/标题/列表项/表格单元格之后（`pure` 模式直接替换原文）。正文块的字号跟随原文（`1em`），标题块的译文固定 15px（避免继承标题的巨大字号）。

`title` / `issueHtmlTitle` / `pullRequestHtmlTitle` / `description` 这类字段的双语拼接由 `TitleFormat` 控制：

- `html`（默认）：`原文<br><span style="font-size:0.85em;font-weight:400;color:#57606a">译文</span>` —— 译文另起一行、字号更小、灰色，与原标题区分开。
- `text`：`原文\n译：译文` —— 加「译：」前缀，任何渲染器下都能看出哪句是译文；**如果你在 App 里看到尖括号标签原样显示，说明该字段不是按 HTML 渲染，切到 text**。

## 翻译范围（按 GraphQL 字段）

| 界面 | 字段 |
|---|---|
| 仓库首页 | `repository.readme.contentHTML`、`repository.description` / `descriptionHTML` |
| issue / PR 详情 | `issueOrPullRequest.bodyHTML`、`timelineItems.nodes[].bodyHTML`、`title`/`issueHtmlTitle` |
| issue / PR 列表 | `search.nodes[].title` / `issueHtmlTitle` / `pullRequestHtmlTitle` |
| Release | `release.descriptionHTML`、`latestRelease.descriptionHTML` |

`name` / `url` 等标识性字段一律不翻（仓库名、用户名、分支名不动）。


## 实测数据（本机样本）

| 场景 | 耗时 | 结果 |
|---|---|---|
| README（21.9 KB HTML，88 段） | 1.1–2.1 s | 双语正常，代码块/表格/SVG 未受影响 |
| issue/PR 列表（20 条标题，去重后 20 段） | 0.24–0.3 s | 标题双语/纯译文均正常 |
| Release 说明（1.8 KB） | 0.2–1.0 s | 正常 |
| 二次打开同一页面 | 6–32 ms | `$persistentStore` 命中缓存，不再发请求 |

## 已知边界

- 只覆盖 GraphQL 里的 `contentHTML` / `bodyHTML` / `descriptionHTML` 三类字段；issue **列表页**只有标题，列表页正文不翻（App 不请求）。
- 翻译走 Google 免费端点，可能偶发失败或限流；失败/超时（9 s）时自动返回原文，不会卡住 App。
- 内容已是目标语言（中文占字母比例 > 35%）时自动跳过。
- 缓存上限 24 条，超出按最近使用淘汰。

## 缓存

| 项 | 值 |
|---|---|
| 存储位置 | Loon 脚本持久化存储（`$persistentStore`，落盘在 Loon App 容器内） |
| 退出 App / 重启手机 | **不丢** |
| 过期时间 | **无 TTL**。key 里含源文内容哈希，内容一变 key 就变，不会读到过期译文 |
| 译文格式变更 | `CACHE_VERSION` 递增即整体作废旧缓存（避免改了排版却仍吐旧格式） |
| 容量 | **300 条 / 2 MB**，超出后从最旧（最少使用）开始淘汰 |
| 命中效果 | 实测 3–40 ms，且不再发翻译请求 |
| 清空方式 | 打开 `ClearCache` 开关跑一次（等于临时停用缓存），用完手动关掉 |

缓存按**字段**计：README 正文 1 条、仓库简介 1 条、每个 issue/PR 标题 1 条（同一页面里的重复标题会去重）。

## 本地开发

`test/run_fixtures.js` 用 node 模拟 Loon 运行时跑抓包样本，`test/inspect.js` 单文件排查：

```bash
node test/run_fixtures.js bilingual   # 生成 preview/preview-bilingual.html
node test/run_fixtures.js pure
node test/inspect.js <fixture名> bilingual   # 单样本排查
node test/cache_test.js                      # 缓存淘汰/LRU/清空开关
```

`fixtures/` 是 Loon 抓包导出的 GraphQL 响应样本（已剔除含账号信息的条目）。

## 实现注意（Loon 运行时坑，已按官方文档核对）

- `$httpClient` 的 `timeout` 单位是**毫秒**（默认 5000），不是秒 → 本脚本用 `HTTP_TIMEOUT_MS = 8000`。
- Loon 里 `setInterval` 只触发一次、`clearTimeout` 不可靠 → 超时兜底用 `setTimeout` + 一次性 `$done` 保护标志，重复调用无害。
- 删缓存键用 `$persistentStore.write(undefined, key)`，不要用 `""`/`false`（会被当成有效值）。
- 插件行 `timeout=60` 是脚本级超时；脚本内部另有 9 s 软超时，到点回原文，避免拖慢 App 首屏。
