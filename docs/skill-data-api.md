# Skill 数据写入 API

当前 v2 系统没有单独命名为 `skill`、`import` 或 `ingest` 的专用 API。已有可用能力是通用状态接口：外部脚本、自动化 skill 或数据整理工具可以通过 `GET /api/state` 读取完整业务状态，合并本次要写入的数据后，再通过 `POST /api/state` 把完整状态写回系统。

这套接口适合“skill 向系统内传数据”的场景，但它是整包状态写入，不是增量导入接口。

## 接口清单

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/api/health` | 检查服务和 MySQL 表状态。 |
| `GET` | `/api/state` | 读取当前完整业务状态。 |
| `POST` | `/api/state` | 覆盖写入完整业务状态。 |

默认本地地址：

```text
http://localhost:3200
```

## 状态结构

`POST /api/state` 接收一个 JSON 对象，顶层字段与系统九类业务对象一致：

```json
{
  "meta": {},
  "customers": [],
  "orders": [],
  "dishes": [],
  "recipes": [],
  "dailyOut": [],
  "feedbacks": [],
  "labels": [],
  "deliveries": [],
  "posters": []
}
```

各字段含义：

| 字段 | 含义 | 存储方式 |
| --- | --- | --- |
| `customers` | 客户档案与体重记录 | 结构化表 `customers` |
| `orders` | 服务订单 | 结构化表 `orders` |
| `dishes` | 菜品库 | 结构化表 `dishes` |
| `recipes` | 每日食谱 | 结构化表 `recipes` |
| `dailyOut` | 每日出餐 | 结构化表 `daily_out` |
| `feedbacks` | 客户反馈 | 结构化表 `feedbacks` |
| `labels` | 标签内容 | `payload JSON` 完整保存 |
| `deliveries` | 配送清单 | `payload JSON` 完整保存 |
| `posters` | 总结海报 | `payload JSON` 完整保存 |

`meta` 可以随请求传入，但当前后端不会持久化传入的 `meta`。读取时系统会重新生成：

```json
{
  "schemaVersion": 2,
  "savedAt": "2026-08-02T00:00:00.000Z",
  "storage": "mysql"
}
```

## 写入语义

`POST /api/state` 是整包覆盖写入：

- 后端会在一个数据库事务中清空九张业务表，再按请求体重新插入数据。
- 如果事务中任何一步失败，数据库会回滚到写入前状态。
- 未传或不是数组的顶层业务字段会被当作空数组处理。
- 因此，调用方如果只传 `customers`，其他八类业务数据会被清空。
- 推荐调用方先 `GET /api/state`，在完整状态上合并本次数据，再 `POST /api/state`。

结构化表只保存后端已映射的字段，未映射字段会被丢弃。`labels`、`deliveries`、`posters` 使用 `payload JSON` 保存完整对象，适合暂时承载更灵活的业务字段。

## 调用示例

读取当前状态：

```bash
curl http://localhost:3200/api/state
```

写入完整状态：

```bash
curl -X POST http://localhost:3200/api/state \
  -H "Content-Type: application/json" \
  --data-binary @state.json
```

成功响应：

```json
{
  "ok": true,
  "savedAt": "2026-08-02T00:00:00.000Z"
}
```

失败响应示例：

```json
{
  "ok": false,
  "message": "服务异常"
}
```

## Skill 推荐流程

外部 skill 向系统写入数据时，建议固定使用以下流程：

1. 调用 `GET /api/health`，确认服务和数据库可用。
2. 调用 `GET /api/state`，拿到当前完整业务状态。
3. 在本地校验和合并要写入的数据，保持九类顶层数组齐全。
4. 调用 `POST /api/state`，提交完整状态。
5. 再次调用 `GET /api/state` 或 `GET /api/health`，确认写入结果。

## 数据要求

通用要求：

- 请求头使用 `Content-Type: application/json`。
- 单次请求体大小上限为 `25mb`。
- 每条业务对象需要稳定的 `id`，缺少 `id` 的对象通常会被跳过。
- 日期字段使用 `YYYY-MM-DD`，时间戳字段使用 ISO 字符串或系统现有格式。

关键字段提示：

| 对象 | 关键字段 |
| --- | --- |
| `customers` | `id`、`name`、`phone` |
| `orders` | `id`、`orderNo`、`customerId`、`serviceType`、`startDate`、`endDate` |
| `dishes` | `id`、`name`、`category` |
| `recipes` | `id`、`date`、`meals` |
| `dailyOut` | `id`、`date`、`meal`、`customerId`、`items` |
| `feedbacks` | `id`、`date`、`customerId` |
| `labels` | `id`、`date`、`meal`、`customerId` |
| `deliveries` | `id`、`date`、`meal`、`customerId` |
| `posters` | `id`、`generatedAt`、`orderId`、`customerId` |

## 当前边界

当前接口还没有以下能力：

- 没有单条新增、单条更新或局部 patch API。
- 没有导入预检、字段级错误报告或冲突合并能力。
- 没有面向 skill 的鉴权、来源标识或审计日志。
- 没有并发写入保护；多个调用方同时写入时，最后一次成功写入会覆盖前一次结果。

在公开网络部署时，不建议直接暴露 `/api/state` 写入接口。当前系统没有登录鉴权，生产使用应放在可信内网、访问网关或后续补充权限控制之后。
