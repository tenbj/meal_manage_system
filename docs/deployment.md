# 部署入口

当前 Docker 与既有数据库升级流程见 [Docker部署.md](Docker部署.md)。数据库初始化和升级统一显式调用 `node scripts/migrate.js`，不再提供样例覆盖入口。
