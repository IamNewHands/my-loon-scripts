# my-loon-scripts

个人自用 Loon 插件/脚本合集。

每个插件的详细说明见对应文件夹内的 README。

## 目录

| 插件 | 说明 | 导入 |
|------|------|------|
| **ipquality** | 节点 IP 质量检测（类型、风险评分、流媒体解锁） | [📥](https://raw.githubusercontent.com/IamNewHands/my-loon-scripts/main/loon/ipquality/ipquality.lpx) |

> 📥 列点击即可在 Loon 中一键导入插件。

## 使用方法

1. 在 Loon 中点击上方表格中的 📥 链接，自动导入插件
2. 或手动复制链接到 Loon → 插件 → 右上角➕ → 粘贴安装
3. 在节点或策略组页面长按目标节点，选择「节点 IP 质量检测」运行

## 仓库结构

```
my-loon-scripts/
├── README.md
├── README.zh-CN.md
├── LICENSE
└── loon/
    └── ipquality/
        ├── README.md
        ├── ipquality.js      # 脚本代码
        └── ipquality.lpx     # Loon 插件定义
```

## 添加插件

1. 在 `loon/` 下创建 `Your-Plugin/` 文件夹
2. 放入 `.js` 脚本文件和 `.lpx` 插件定义文件
3. 在根 README 目录表格中添加一行

## 许可证

MIT — 见 LICENSE 文件。

第三方原创归原作者所有，详见各插件内版权声明。