# 减脂双餐后台管理系统 v2

商家首页现为四入口的简化工作台：备餐工作台、客户与订餐、我的菜品、店铺设置。默认准备明天，按照「主菜单＋1–2 道备用菜 → 确认用餐人和忌口 → 生成并打印餐盒标签」操作。次日先贴标签，再按标签上的克重分装。后端使用 MySQL 持久化。

备用菜独立保存，不默认计入每盒；忌口冲突可直接点选适用的备用菜，只更新当前餐盒的菜品、克重和热量。备用菜本身有冲突或食材不完整时不能直接替换。名单支持按餐暂停、恢复及批量添加现有客户；配送必须填写地址，自提需明确选择。

标签突出昵称、逐道菜的克重、总热量、配送地址或自提信息。菜单或名单变化后需重新确认；已经打印且受影响的标签提示重打。纸张容纳不下内容时阻止打印并提示调整尺寸，避免裁掉地址或重量。没有完整热量时须明确确认后才能打印标记为待补充的标签。未来日期不能提前确认出餐完成。

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
