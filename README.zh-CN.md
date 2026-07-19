# my-loon-scripts

个人自用 Loon 插件/脚本合集。

## 目录

| 插件 | 说明 | 导入 |
|------|------|------|
| **节点检测工具** | 入口落地、地理位置、流媒体解锁、风险评分 4 个独立脚本 | [📥](https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/ipquality/ipquality.lpx) |

> 📥 列点击即可在 Loon 中一键导入插件。

## 使用方法

1. 在 Loon 中点击上方表格中的 📥 链接，自动导入插件
2. 在节点或策略组页面长按目标节点，选择对应功能运行

## 仓库结构

```
my-loon-scripts/
├── README.md
├── README.zh-CN.md
└── loon/
    └── ipquality/
        ├── README.md
        ├── ipquality.lpx      # 插件定义（4个脚本）
        ├── entry-exit.js      # 入口落地查询
        ├── location.js        # 地理位置查询
        ├── unlock.js          # 节点解锁查询
        └── risk.js            # 风险评分查询
```

## 许可证

MIT
