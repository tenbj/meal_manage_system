# 部署指引

## 1. 环境要求

- Node.js 20 或以上
- npm
- 可访问的 MySQL 8 / 兼容 MySQL 服务

本项目已在本机 Node.js 24、npm 11 环境下验证。

## 2. 文件结构

```text
meal-manage-system-v2/
  public/                 # 真实系统前端页面
  src/                    # Express 后端与数据库访问层
  scripts/                # 建库、种子数据、冒烟测试脚本
  tests/                  # 自动化测试
  docs/                   # 部署文档
  prototype-source/       # 原始原型归档，不参与运行
```

## 3. 配置环境变量

复制 `.env.example` 为 `.env`，填入真实数据库信息。

```dotenv
DB_HOST=你的数据库地址
DB_PORT=3306
DB_USER=你的用户名
DB_PASSWORD=你的密码
DB_NAME=meal_manage_system_v2
DB_CHARSET=utf8mb4
PORT=3200
```

当前机器已经配置好 `.env`。`.env` 不进入 Git，避免泄露密码。

## 4. 安装依赖

```bash
npm install
```

## 5. 创建数据库和表

```bash
npm run db:setup
```

脚本只会创建并使用 `DB_NAME` 指定的新数据库。不要把 `DB_NAME` 指向已有业务库。

## 6. 初始化样例数据

```bash
npm run db:seed
```

默认只在数据库为空时写入原型样例数据。如果已有数据，脚本会跳过，避免覆盖。

## 7. 启动服务

```bash
npm start
```

浏览器访问：

```text
http://localhost:3200
```

## 8. 验证

```bash
npm test
npm run smoke
```

也可以打开健康检查：

```text
http://localhost:3200/api/health
```

返回中的 `storage` 应为 `mysql`，`tables` 会显示各实体表行数。

## 9. 数据表

系统使用以下实体表：

- `customers`
- `orders`
- `dishes`
- `recipes`
- `daily_out`
- `feedbacks`
- `labels`
- `deliveries`
- `posters`

标签、配送、海报包含灵活字段，表中使用 `payload JSON` 保存完整业务对象，同时抽取日期、餐次、客户等常用索引字段。

## 10. 后续维护提示

- 原型归档在 `prototype-source/`，不要直接改这里。
- 运行系统页面在 `public/`。
- 后端入口是 `src/server.js`。
- 数据库初始化入口是 `scripts/setup-db.js`。
- 如需重新初始化样例数据，请先确认没有重要数据，再执行 `node scripts/seed-db-from-prototype.js --force`。

## 11. API 文档

外部脚本或自动化 skill 需要向系统写入业务数据时，见 [Skill 数据写入 API](skill-data-api.md)。
