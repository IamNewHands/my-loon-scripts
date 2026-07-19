# 节点 IP 质量检测

Loon 插件，用于检测节点出口 IP 的类型、风险评分、流媒体与 AI 服务解锁情况。

## 功能

- **IP 探测**：多源交叉验证出口 IP
- **基础信息**：国家、城市、ASN、网络组织
- **IP 类型**：机房 / 家宽 / 手机 / CDN 等
- **风险评分**：IPQS、Scamalytics、IP2Location 等多库评分
- **风险因素**：VPN / 代理 / Tor / 机房 / 滥用等标记
- **流媒体检测**：TikTok、Disney+、Netflix、YouTube、Prime Video、Reddit、ChatGPT

## 安装

在 Loon 中点击下方链接一键导入：

[📥 安装插件](https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/ipquality/ipquality.lpx)

## 使用

在 Loon 的节点或策略组页面，长按目标节点，选择「节点 IP 质量检测」即可。

## 配置

插件支持以下开关（在 Loon 插件设置中调整）：

- `MaskIP`：是否隐藏 IP 地址（默认关闭）
- `MediaTest`：是否检测流媒体（默认开启）
- `MapNotification`：是否推送地图通知（默认关闭）

## 优化说明

此版本在原版基础上做了以下优化：

- 风险因素卡片默认折叠，减少页面 DOM 节点量
- 限制并发请求数为 5，避免网络层过载
- 添加 3 分钟结果缓存，重复检测直接复用
- 精简 HTML 内联样式，减少渲染开销
- 保留完整检测功能，不影响检测结果

## 致谢

- 原作者：MaYIHEI
- 参考项目：xykt/IPQuality、Roddy-D/Loon_plugins