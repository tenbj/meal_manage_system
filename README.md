# 小饭桌 / Meal Desk

按账号独立管理客户、菜品、订单和每日出餐。支持用户自行注册，浏览器会话以及个人 API / MCP 凭据。历史数据迁移归入 test；首次密码由部署者私密设置，不提供公开默认密码。

## 启动与部署

版本：0.4.1。已完成隔离 Docker 验收；GitHub 发布状态以仓库 Release 为准。Node.js 24、MySQL 8.4、Docker Compose。应用默认仅绑定宿主机回环地址。

1. 按 [.env.example](.env.example) 在仓库外创建私有配置。
2. 按 [Docker 部署](docs/Docker部署.md) 构建、备份并显式运行 `node scripts/migrate.js`。
3. 启动应用后访问 `/login`。新用户自行注册；原数据归 test，其他账号从空白工作台开始。

既有 MySQL 仅使用 compose.yaml；独立 MySQL 使用 compose.database.yaml。不要将升级解释为创建替代生产库；不要对生产运行测试或样例播种。

支持主入口 PUBLIC_URL 和逗号分隔 ADDITIONAL_PUBLIC_URLS。按协议、域名、端口精确验证来源；HTTP/HTTPS 分别保存登录会话、共享账号数据。HTTPS 在外部代理终止，例见部署说明。

## 业务与接入

保留备餐、逐人分装、餐次余额、菜单与备用菜、忌口核对、菜品热量来源等现有功能。自动营养分配仅提供可调整的商家备餐参考。

- [账号与数据隔离](docs/账号与数据隔离.md)
- [中文 API](docs/API中文说明.md)、[OpenAPI](docs/openapi.json)
- [AI / MCP 接入](docs/AI接入与调用指南.md)，MCP 路径 `/mcp`
- [架构图](docs/diagrams/architecture.html)、[ER 图](docs/diagrams/erd.html)

薄荷连接密钥按账号保存在 MySQL，接口不回显。数据库与备份须私密保管；未配置有效密钥时，不能声称外部薄荷服务已验证。

## 开发与测试

`npm ci` 后运行 `npm test`。测试统一在 tests 下；详细命令、依赖与隔离约束见 [测试说明](tests/README.md)。`npm run docs` 从当前源码生成模型、双图和 API 说明。

旧 db:setup、db:seed、smoke 和无账号过滤的历史清理脚本已撤下。数据库维护使用显式迁移，不自动初始化演示数据。

## 发布与验收

[更新记录](CHANGELOG.md) 按功能列明本次相对 v0.2.0 的变化。verification 仅保留当前发布对应的脱敏证据；本地临时上下文、备份及凭据放在忽略目录 .test-runs，禁止提交和入包。

GitHub 发布与生产部署是不同动作。当前合同为 ready，已完成本轮隔离 Docker、真实双协议浏览器、API/MCP、自主工具操作及恢复验收；这不代表现有生产系统已更新。项目包不自动重启现有生产系统。许可证尚未选择，见 LICENSE。
