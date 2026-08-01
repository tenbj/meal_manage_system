# 减脂双餐后台管理系统 v2

这是从离线高保真原型迁出的真实可用版本。页面结构和交互尽量保持原型一致，后端使用 MySQL 持久化，不再把业务数据只保存在浏览器内存或 `localStorage` 中。

## 技术栈

- Node.js + Express
- MySQL / mysql2
- 原型页面：原样迁移到 `public/`
- 原始原型归档：`prototype-source/`

## 常用命令

```bash
npm install
npm run db:setup
npm run db:seed
npm start
```

启动后访问：

```text
http://localhost:3200
```

健康检查：

```text
http://localhost:3200/api/health
```

更多部署细节见 [docs/deployment.md](docs/deployment.md)。

外部脚本或自动化 skill 需要向系统写入业务数据时，见 [docs/skill-data-api.md](docs/skill-data-api.md)。
