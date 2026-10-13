# 餐食管理系统 API 中文说明

统一认证：Authorization: Bearer <访问令牌>。登录账号菜单 → 账号设置 → API / MCP 接入，创建自己的只读或读写凭据。网页使用7天可撤销HttpOnly Cookie：HTTP 为 meal_session_http，HTTPS 为带 Secure 属性的 meal_session_https；两个入口独立退出。所有新旧接口都按当前账号隔离；请求参数不能指定其他账号。旧环境令牌仅迁入test账号，撤销后不会从环境恢复。

新版接口读取并修改同一个 merchant_workspace，与网页立即一致。旧 /api/state 和 /api/ai/* 保留但面向旧九张表，不适合作为新版写入口；所有旧接口也受统一认证。

## 读取系统状态

`GET /api/health` → MCP `get_system_status`

无副作用，返回业务 JSON。

## 读取商家工作台

`GET /api/merchant` → MCP `get_workspace`

无副作用，返回业务 JSON。

## 新增客户

`POST /api/v1/customers` → MCP `create_customer`

必填 request_id（8–100字符）、expected_version（当前 revision）、evidence（来源/依据）；业务字段：name、phone、address、fulfillment。JSON 类型由 MCP inputSchema 定义；同号同内容返回原响应，同号异内容或版本过期返回 409。写入和幂等日志同事务提交。

## 登记购买餐次

`POST /api/v1/orders` → MCP `create_order`

必填 request_id（8–100字符）、expected_version（当前 revision）、evidence（来源/依据）；业务字段：customer_id、start_date、end_date、credits、price。JSON 类型由 MCP inputSchema 定义；同号同内容返回原响应，同号异内容或版本过期返回 409。写入和幂等日志同事务提交。

## 新增有依据的菜品

`POST /api/v1/dishes` → MCP `create_dish`

必填 request_id（8–100字符）、expected_version（当前 revision）、evidence（来源/依据）；业务字段：name、category、kcal100、ingredients、reference。JSON 类型由 MCP inputSchema 定义；同号同内容返回原响应，同号异内容或版本过期返回 409。写入和幂等日志同事务提交。

## 设置本餐菜单

`POST /api/v1/menus` → MCP `set_menu`

必填 request_id（8–100字符）、expected_version（当前 revision）、evidence（来源/依据）；业务字段：date、meal、items。JSON 类型由 MCP inputSchema 定义；同号同内容返回原响应，同号异内容或版本过期返回 409。写入和幂等日志同事务提交。

## 确认菜单

`POST /api/v1/menus/confirm` → MCP `confirm_menu`

必填 request_id（8–100字符）、expected_version（当前 revision）、evidence（来源/依据）；业务字段：date、meal。JSON 类型由 MCP inputSchema 定义；同号同内容返回原响应，同号异内容或版本过期返回 409。写入和幂等日志同事务提交。

## 安排用餐人

`POST /api/v1/diners` → MCP `add_diner`

必填 request_id（8–100字符）、expected_version（当前 revision）、evidence（来源/依据）；业务字段：customer_id、date、meal。JSON 类型由 MCP inputSchema 定义；同号同内容返回原响应，同号异内容或版本过期返回 409。写入和幂等日志同事务提交。

## 确认用餐与标签条件

`POST /api/v1/diners/confirm` → MCP `confirm_roster`

必填 request_id（8–100字符）、expected_version（当前 revision）、evidence（来源/依据）；业务字段：date、meal。JSON 类型由 MCP inputSchema 定义；同号同内容返回原响应，同号异内容或版本过期返回 409。写入和幂等日志同事务提交。

## 完成出餐并扣餐

`POST /api/v1/boxes/finish` → MCP `finish_boxes`

必填 request_id（8–100字符）、expected_version（当前 revision）、evidence（来源/依据）；业务字段：box_ids。JSON 类型由 MCP inputSchema 定义；同号同内容返回原响应，同号异内容或版本过期返回 409。写入和幂等日志同事务提交。

## 取消用餐并记录原因

`POST /api/v1/boxes/cancel` → MCP `cancel_box`

必填 request_id（8–100字符）、expected_version（当前 revision）、evidence（来源/依据）；业务字段：box_id、charge、reason。JSON 类型由 MCP inputSchema 定义；同号同内容返回原响应，同号异内容或版本过期返回 409。写入和幂等日志同事务提交。

## 恢复已取消或暂停的用餐

`POST /api/v1/boxes/resume` → MCP `resume_box`

必填 request_id（8–100字符）、expected_version（当前 revision）、evidence（来源/依据）；业务字段：box_id。JSON 类型由 MCP inputSchema 定义；同号同内容返回原响应，同号异内容或版本过期返回 409。写入和幂等日志同事务提交。

## 追加餐次调整流水

`POST /api/v1/credits` → MCP `adjust_credits`

必填 request_id（8–100字符）、expected_version（当前 revision）、evidence（来源/依据）；业务字段：order_id、balance、reason。JSON 类型由 MCP inputSchema 定义；同号同内容返回原响应，同号异内容或版本过期返回 409。写入和幂等日志同事务提交。

## 读取薄荷连接状态

`GET /api/merchant/nutrition/status`（私密连接管理仅页面/直接API）

仅返回配置状态、版本和可迁移旧配置标记，不返回密钥。

## 验证并保存薄荷连接

`POST /api/merchant/nutrition/connect`（私密连接管理仅页面/直接API）

已认证写权限。JSON字段 apiKey 为私密输入，expectedVersion 为状态接口的配置版本（首次0）；先校验provider成功再CAS事务写入，失败不改旧值、并发冲突409。密钥不回传，不进入业务JSON或通用MCP。

## 检测已保存的薄荷连接

`POST /api/merchant/nutrition/check`（私密连接管理仅页面/直接API）

已认证写权限。空JSON对象，实际调用薄荷，只有成功响应才算外部验证通过。

## 显式迁移旧薄荷连接

`POST /api/merchant/nutrition/migrate-legacy`（私密连接管理仅页面/直接API）

已认证写权限。空JSON对象；只在数据库无配置时验证旧.runtime/env密钥并插入。数据库已有配置返回409，保留原文件供恢复。数据库不可用503，不回退旧文件伪装成功。

## 错误与边界
401 未认证，403 只读不能写或来源不匹配，409 重读再使用新请求号，422 输入或领域校验失败，503 服务不可用。不会把失败报告为成功。

薄荷连接为可选外部功能，未配置时返回 503；不伪造营养信息。