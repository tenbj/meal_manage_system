# AI 功能写入 API

v2 系统现在提供一组专门给 AI、自动化 skill 和外部脚本使用的功能级写入 API。它们不是“写 SQL”接口，也不是整包覆盖接口，而是按系统业务功能约束到“新增客户、订单、菜品、食谱、出餐、反馈、标签、配送、海报”等明确动作。

默认本地地址：

```text
http://localhost:3200
```

## 功能盘点

当前系统的业务功能可归为 9 类：

| 功能 | 页面入口 | AI 常见写入场景 |
| --- | --- | --- |
| 客户档案 | 客户档案 | 从表单、聊天记录或咨询记录中整理新客户资料。 |
| 服务订单 | 服务订单 | 根据成交信息创建体验或正式服务周期。 |
| 菜品管理 | 菜品管理 | 从食谱、备菜单或营养资料中补充菜品库。 |
| 食谱管理 | 食谱管理 | 写入某天午餐、晚餐的分类菜品安排。 |
| 每日出餐 | 每日出餐 | 写入某客户某餐的菜品克重与暂停/替换标记。 |
| 客户反馈 | 客户反馈 | 从微信反馈中提取体重、饱腹感、吃完情况和备注。 |
| 餐盒标签 | 标签与配送 | 写入已生成的餐盒标签内容。 |
| 配送记录 | 标签与配送 | 写入配送地址、电话、餐品内容和备注。 |
| 总结海报 | 服务总结海报 | 保存 AI 生成的服务总结文案和统计摘要。 |

AI 写入优先使用下面的 `/api/ai/*` 接口。旧的 `/api/state` 仍保留给系统维护使用，但不建议 skill 日常调用。

## 能力清单接口

```http
GET /api/ai/capabilities
```

返回当前开放的 AI 写入动作、路径、必填字段和可选字段。skill 可以先读取它确认系统版本支持哪些功能。

## 写入接口

所有写入接口都使用 `POST` 和 `application/json`。

| 功能 | 方法与路径 | 必填字段 |
| --- | --- | --- |
| 新增客户档案 | `POST /api/ai/customers` | `name`、`phone` |
| 新增服务订单 | `POST /api/ai/orders` | `customerId`、`serviceType`、`startDate` |
| 新增菜品 | `POST /api/ai/dishes` | `name` |
| 新增每日食谱 | `POST /api/ai/recipes` | `date`、`meals` |
| 新增单餐出餐记录 | `POST /api/ai/daily-out` | `date`、`meal`、`customerId`、`items` |
| 新增客户反馈 | `POST /api/ai/feedbacks` | `date`、`customerId` |
| 新增餐盒标签 | `POST /api/ai/labels` | `date`、`meal`、`customerId`、`text` |
| 新增配送记录 | `POST /api/ai/deliveries` | `date`、`meal`、`customerId`、`content`、`address` |
| 新增服务总结海报记录 | `POST /api/ai/posters` | `customerId`、`orderId`、`summaryText` |

通用约束：

- 只支持新增，不支持任意 SQL、删除、整包覆盖或局部 patch。
- 如果不传 `id`，后端会自动生成稳定前缀 id。
- 日期字段使用 `YYYY-MM-DD`。
- `meal` 只能是 `lunch` 或 `dinner`。
- 菜品分类只能是 `荤`、`海鲜`、`素`、`主食`。
- 重复主键会返回 `409`，需要人工判断是否改为更新或重新创建。

## 鉴权

`.env` 中可以配置：

```dotenv
AI_WRITE_TOKEN=一段只给自动化调用方使用的令牌
```

配置后，所有 `POST /api/ai/*` 请求必须带其中一种：

```http
Authorization: Bearer 一段只给自动化调用方使用的令牌
```

或：

```http
X-AI-Write-Token: 一段只给自动化调用方使用的令牌
```

如果 `AI_WRITE_TOKEN` 为空，本地开发环境会允许直接写入。公开网络部署时必须配置令牌，并放在可信网络或访问网关后面。

## 示例

新增客户：

```bash
curl -X POST http://localhost:3200/api/ai/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AI_WRITE_TOKEN" \
  -d '{
    "name": "张三",
    "phone": "13800000000",
    "gender": "女",
    "currentWeight": 62.5,
    "targetWeight": 56,
    "restrictions": ["花生"],
    "notes": "晚餐不要太辣"
  }'
```

新增菜品：

```bash
curl -X POST http://localhost:3200/api/ai/dishes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AI_WRITE_TOKEN" \
  -d '{
    "name": "番茄龙利鱼",
    "category": "海鲜",
    "ingredients": ["龙利鱼", "番茄"],
    "kcal100": 108,
    "protein": 19,
    "fat": 2.8,
    "carbs": 4,
    "source": "AI 整理，待人工复核"
  }'
```

新增食谱：

```bash
curl -X POST http://localhost:3200/api/ai/recipes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AI_WRITE_TOKEN" \
  -d '{
    "date": "2026-08-02",
    "meals": {
      "lunch": {
        "categories": {
          "荤": "dish_chicken",
          "海鲜": "dish_fish",
          "素": "dish_veg",
          "主食": "dish_rice"
        }
      },
      "dinner": {
        "categories": {
          "荤": "dish_beef",
          "海鲜": "dish_shrimp",
          "素": "dish_spinach",
          "主食": "dish_corn"
        }
      }
    }
  }'
```

新增客户反馈：

```bash
curl -X POST http://localhost:3200/api/ai/feedbacks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AI_WRITE_TOKEN" \
  -d '{
    "date": "2026-08-02",
    "customerId": "cus_001",
    "weight": 61.8,
    "lunchFinished": "是",
    "dinnerFinished": "否",
    "satiety": "偏饿",
    "bodyNote": "晚上运动后饿",
    "adminNote": "明日晚餐主食略增"
  }'
```

成功响应：

```json
{
  "ok": true,
  "entity": "customer",
  "action": "createCustomer",
  "id": "cus_lzxxxx_ab12cd34",
  "record": {},
  "savedAt": "2026-08-02T00:00:00.000Z"
}
```

字段错误响应：

```json
{
  "ok": false,
  "code": "AI_WRITE_VALIDATION_ERROR",
  "message": "请求数据不符合 AI 写入 API 要求",
  "details": [
    { "field": "phone", "message": "必填" }
  ]
}
```

## 旧状态接口边界

系统仍保留：

- `GET /api/state`
- `POST /api/state`

`POST /api/state` 是整包覆盖写入，会先清空九类业务表再重新插入，不适合作为普通 skill 的数据入口。只有做迁移、备份恢复或完整状态同步时，才考虑使用它。
