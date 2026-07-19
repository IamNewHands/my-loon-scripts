# 节点检测工具

Loon 节点检测工具合集，包含 4 个独立脚本，每个只查一个数据源，快速出结果。

## 脚本列表

| 脚本 | 说明 | 超时 |
|------|------|------|
| **入口落地查询** | 检测节点出口 IP、国家、城市、ASN、ISP、坐标 | 10s |
| **地理位置查询** | 检测节点出口 IP 地理位置详情 | 10s |
| **节点解锁查询** | 检测 Netflix / Disney+ / YouTube / ChatGPT / TikTok 解锁 | 20s |
| **风险评分查询** | 检测 IP 风险评分（IPQS）、代理/VPN/Tor 标记 | 10s |

## 安装

在 Loon 中点击下方链接一键导入：

[📥 安装插件](https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/ipquality/ipquality.lpx)

## 使用

在 Loon 的节点或策略组页面，长按目标节点，选择对应功能即可。

## 数据来源

- 入口/地理位置: ip-api.com
- 流媒体解锁: Netflix / Disney+ / YouTube / ChatGPT / TikTok 官方页面
- 风险评分: IPQualityScore (via ipinfo.check.place)

## 致谢

- 参考项目: Moli-X/Tool, KOP-XIAO/QuantumultX, xream/scripts
- 原作者: MaYIHEI, xream, Keywos, KOP-XIAO, dcpengx
