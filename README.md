# 减脂双餐后台管理系统 v2

商家首页现为四入口的简化工作台：今日出餐、客户与订餐、我的菜品、店铺设置。菜单、分装、订单标签集中在同一页，支持单次订餐、包餐、暂停、餐次扣除和打印。后端使用 MySQL 持久化。

新版使用 `/api/merchant` 和 `merchant_workspace` 表，第一次读取时从旧系统导入客户、订单、菜品及出餐记录，原表保留。此后新版数据以新表为准，旧 `/api/state`、AI 写入接口和原版页面的写入不会同步到新版，暂勿混用。旧字段和原表未删除，旧反馈与海报仍保留在原系统；新版聚焦出餐流程。

热量外部来源限定为薄荷健康；实际 API 适配尚未接入，需要授权配置与字段文档。当前支持手动录入并记录依据，旧热量统一标记待确认，不会伪装成薄荷数据或按零值输出。缺失历史菜品引用保留为待补全记录。

打印使用浏览器打印（可存为 PDF），默认纸张 50 × 70 mm，可在店铺设置调整。确认打印不扣餐次，确认出餐完成才扣；历史完成记录保留菜品数据快照。修改未完成餐盒会提示重打标签。

## 技术栈

- Node.js + Express
- MySQL / mysql2
- 商家工作台：`public/index.html` 与 `public/assets/merchant*`
- 原始原型归档：`prototype-source/`

## 常用命令

```bash
npm install
npm run db:setup
npm run db:seed
npm start
```

与原版同时验收时，可在 PowerShell 使用 `$env:PORT='3201'; npm start`，访问 `http://localhost:3201`。端口由环境变量决定，默认仍为 3200。

验证使用 `npm test` 和 `npm run smoke`。受限环境无法启动测试子进程时，可使用 `node --test --test-isolation=none tests/*.test.js`。浏览器测试应通过网络拦截使用隔离数据，避免向真实业务数据写入测试客户。

启动后访问：

```text
http://localhost:3200
```

健康检查：

```text
http://localhost:3200/api/health
```

更多部署细节见 [docs/deployment.md](docs/deployment.md)。

原版外部脚本接口见 [AI 功能写入 API](docs/skill-data-api.md)，这些接口只影响旧数据表，尚未迁移到新版出餐工作台。

端到端检查脚本为 `scripts/check-merchant-ui.cjs`。使用已安装的 Playwright（可用 `PLAYWRIGHT_MODULE` 指定模块路径）及本机 Chromium，`MERCHANT_URL` 默认指向 `http://localhost:3201`。脚本只读取真实数据，全部修改请求被拦截到内存测试夹具；截图与打印检查 PDF 保存在忽略目录 `tmp/`。
