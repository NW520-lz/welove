# 进度

## 2026-11-16
- 访谈完成，定稿 docs/spec.md v1
- 建立项目 agent：date-zongguan / date-curator / date-builder / date-tester
- 派出：curator（知识库）、builder（server）、builder（app），三路并行
- 待用户提供：DeepSeek API Key、宝塔子域名（部署前再确认）
- 新增「我们的心愿卡」：两人共用的自定义卡，抽卡时一半概率优先抽（见 spec）；顺带把 app 的接口字段对齐服务端（cards/items/preferencesSet）

## 2026-11-17
- 新增「想看你穿」：我的衣橱（28 种风格，按性别筛选）、点一套给 TA、TA 回「安排！/下次吧」、随机帮我挑、TA 有/当礼物送、心有灵犀提示（见 spec）
- 修：安卓打开就一直显示播放视频 → 去掉全部 `<video>`（欢迎页、骰子、绑定成功）改 CSS 动画，manifest 去掉 VideoPlayer 模块，删 3 个 mp4
- 修：刮刮乐刮开后本机记住，同一次约会再进来不用再刮；刮刮卡宽度按屏幕收窄（原来 305px 在 375 屏上溢出）
- 修排版：点子卡标题/简介超长时用省略号收住；欢迎页「先认识一下」标签被拉满整行
- 「想看你穿」追加：自己加风格（加的人能删）、撤回还没回应的请求
