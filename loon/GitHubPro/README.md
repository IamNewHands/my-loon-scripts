# GitHubPro（Loon 插件）

GitHub iOS 客户端（App Store id 1477376905）增强：**解锁订阅** + **README / issue・PR / Release 正文翻译**。

- 解锁部分原作者 [baby](https://github.com/Yu9191)，逻辑为改写 `api.github.com/graphql` 响应中 `viewer` 的订阅字段。
- 翻译部分：拦截同一个 GraphQL 响应，把 HTML 正文送 Google 免费端点（gtx）翻译后回填，**无需任何密钥**。代码块 `<pre>/<code>`、SVG 图标、链接地址不会被翻译。

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
| TranslateReadme | true | 仓库首页 README |
| TranslateIssue | true | issue/PR 正文与评论、Release 说明（见下） |
| TranslateRelease | false | Release 说明 |
| Debug | false | 在 Loon 脚本日志输出执行信息 |

译文以带左侧灰条的块跟在原文段落/标题/列表项/表格单元格之后（`pure` 模式直接替换原文）。

## 实测数据（本机样本）

| 场景 | 耗时 | 结果 |
|---|---|---|
| README（21.9 KB HTML，88 段） | 1.2–2.1 s | 双语正常，代码块/表格/SVG 未受影响 |
| Release 说明（1.8 KB） | 0.2–1.0 s | 正常 |
| 二次打开同一页面 | 6–32 ms | `$persistentStore` 命中缓存，不再发请求 |

## 已知边界

- 只覆盖 GraphQL 里的 `contentHTML` / `bodyHTML` / `descriptionHTML` 三类字段；issue **列表页**只有标题，列表页正文不翻（App 不请求）。
- 翻译走 Google 免费端点，可能偶发失败或限流；失败/超时（9 s）时自动返回原文，不会卡住 App。
- 内容已是目标语言（中文占字母比例 > 35%）时自动跳过。
- 缓存上限 24 条，超出按最近使用淘汰。

## 本地开发

`test/run_fixtures.js` 用 node 模拟 Loon 运行时跑抓包样本，`test/inspect.js` 单文件排查：

```bash
node test/run_fixtures.js bilingual   # 生成 preview/preview-bilingual.html
node test/run_fixtures.js pure
```

`fixtures/` 是 Loon 抓包导出的 GraphQL 响应样本（已剔除含账号信息的条目）。

## 实现注意（Loon 运行时坑，已按官方文档核对）

- `$httpClient` 的 `timeout` 单位是**毫秒**（默认 5000），不是秒 → 本脚本用 `HTTP_TIMEOUT_MS = 8000`。
- Loon 里 `setInterval` 只触发一次、`clearTimeout` 不可靠 → 超时兜底用 `setTimeout` + 一次性 `$done` 保护标志，重复调用无害。
- 删缓存键用 `$persistentStore.write(undefined, key)`，不要用 `""`/`false`（会被当成有效值）。
- 插件行 `timeout=60` 是脚本级超时；脚本内部另有 9 s 软超时，到点回原文，避免拖慢 App 首屏。
