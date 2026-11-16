# 我们约会吧

情侣约会决策 App。需求和范围以 [docs/spec.md](docs/spec.md) 为准，改范围先改方案。

- `app/`：uni-app（Vue3 + Vite + TS，CLI 工程）。开发用 `npm run dev:h5`，安卓 apk 由用户自己用 HBuilderX 云打包，不要尝试在本机安装 Android SDK。
- `server/`：Node + Express 5 + better-sqlite3。`npm test` 跑测试；`DEEPSEEK_API_KEY` 不设置时走兜底行程。
- `data/`：知识库 JSON，服务端启动时导入。

约束：
- 保持简单：能用一个函数解决就不新建抽象，方案里没有的配置项不加。
- 用库之前先用 context7 查当前文档（uni-app 用 `/websites/uniapp_dcloud_net_cn`）。
- 密钥只放在 `server/.env`（已 gitignore），不要写进代码和日志。
- 部署到宝塔服务器、配置域名之前，必须先得到用户对这一次操作的确认。

Agent 分工见 `.claude/agents/`：总管 `date-zongguan` 负责派活和验收结论，员工分别是 `date-curator`（知识库）、`date-builder`（开发）、`date-tester`（验收）。
