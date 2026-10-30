# wujie-skill

无界（wujie）微前端框架的 [Cursor Agent Skill](https://cursor.com/docs/agent/skills)。安装后，AI 在用户提到 wujie、无界、微前端等场景时自动加载，无需再查官方文档即可完成接入与排障。

**适配版本**：wujie >= 2.1.0

## 安装

```bash
npx skills add wujie-micro/wujie-skill
```

或手动将本仓库复制到 Cursor skills 目录：

```bash
# 个人技能（所有项目可用）
cp -r wujie-skill ~/.cursor/skills/wujie

# 项目技能（仅当前仓库）
cp -r wujie-skill .cursor/skills/wujie
```

## 内容结构

```
wujie-skill/
├── SKILL.md              # 入口：决策树、快速接入
└── references/           # 按需深入
    ├── api.md            # API 与 $wujie
    ├── main-app.md       # Vue2/Vue3/React 封装
    ├── sub-app.md        # 子应用改造
    ├── routing.md        # 路由跳转（含多 Tab）
    ├── modes.md          # 运行模式与性能
    ├── communication.md  # 通信
    ├── plugin-lifecycle.md
    ├── deployment.md     # 部署运维
    └── faq.md            # 排障索引
```

## 与官方文档的关系

本 skill 内容经 **wujie 源码校验** 后从官方 docs/examples 提炼，并补充 GitHub Issue 高频困惑。官方文档：https://wujie-micro.github.io/doc/

## 设计规格

详见 [docs/superpowers/specs/2026-06-16-wujie-skill-design.md](docs/superpowers/specs/2026-06-16-wujie-skill-design.md)

## 仓库

- 本仓库：https://github.com/wujie-micro/wujie-skill
- 无界主仓库：https://github.com/Tencent/wujie
- 在线 demo：https://wujie-micro.github.io/demo-main-vue/home
