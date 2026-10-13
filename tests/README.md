# 测试目录和执行边界

- unit：领域、认证、账号、来源策略的自动测试；npm test，无生产配置。
- e2e：页面场景使用本地文件和内存接口夹具，网络写入被拦截；npm run test:e2e。
- integration：真实隔离 MySQL/API/MCP/浏览器；只接受 Docker runner 生成且回读验证的 .test-runs 上下文。
- docker：构建、旧版升级、重建、备份还原、故障恢复及资源清理。
- support：共享隔离检查、静态浏览器夹具和本机 TLS 代理。
- fixtures：合成输入约定，无真实业务数据或凭据。

需要 Node.js 24、Python 3.11+（cryptography）、Docker Compose。浏览器测试需要 Playwright；安装依赖后运行 `npx playwright install chromium`。可用 BROWSER_EXECUTABLE 指定已有兼容 Chromium 可执行文件。

运行完整隔离验证：

```text
npm ci
npm test
npm run test:e2e
python tests/docker/run.py --baseline-image <本机已保存的0.3版本镜像ID或标签>
```

baseline-image 仅在新建的测试库上运行，绝不连接生产；旧版镜像必须由已知0.3源码构建或可靠备份获得。每次新建随机 Compose 项目，DB_HOST 固定为该网络内 db，独立随机密码及端口；不接受 production.env。测试失败记录保留，默认仅清理本次资源；--keep-on-failure 供显式排错。

完整测试真实写入合成账号和业务数据；外部薄荷调用仅由单测模拟，账号配置持久化使用合成密钥。公网域名、真实外部薄荷和生产数据库不在本轮自动测试范围。

.test-runs 的配置、账号会话、TLS私钥和数据库备份绝不进入 Git/ZIP。只有经审核的脱敏报告及合成页面截图才写入 verification。
