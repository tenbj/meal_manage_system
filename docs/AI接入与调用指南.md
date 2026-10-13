# AI 接入与调用指南

先按 Docker部署.md 安装服务，再为客户端注册 MCP；两件事分开。MCP URL 为宿主机 `http://localhost:3200/mcp`，不是容器服务名。不需要数据库密码，只需管理员分发的私有 Bearer 令牌。远程入口必须先配置并验收 HTTPS。

客户端支持 Streamable HTTP 和 Authorization 请求头时，从自己的账号设置创建只读凭据完成只读任务；明确需要写入时才创建可读写凭据。不要在聊天、配置示例、Git 或 ZIP 中粘贴真实令牌。`scripts/configure_mcp.py` 输出无秘密的配置模板。

固定顺序：`get_system_status` → `get_workspace` → 在用户明确授权和真实来源下调用对应写工具 → `get_workspace` 回读。工具目录见 MCP工具目录.json，实际 SDK list_tools 返回每个业务参数的类型和约束。

写工具覆盖客户、订餐、人工有依据的菜品、菜单设置/确认、用餐安排/确认、完成扣餐、取消/恢复、追加餐次调整。统一传入 request_id、expected_version、evidence。同内容重试必须同 request_id；变更内容需新号；409 先重读 revision，不盲重试。422 纠正业务输入；503 明确失败，不说成功。

旧 `/api/ai/*` 写旧表，不是新版工作台工具。MCP 不调用旧写接口，不直连数据库。示例默认只读；只在隔离环境运行 `examples/api_client.py --write-demo`。不要在真实客户上演示，不把来源写成虚构事实。

未配置薄荷时，可以使用有明确数值依据的人工菜品；不会伪造薄荷验证。当前认证为独立用户账号，API/MCP仅访问凭据所有者的数据；不得传其他账号的owner_id尝试切换身份。API/MCP 操作来源日志存于 api_requests，网页既有业务流水按原实现保留。SDK固定序列证明协议可用；AI自主选择工具验收单独记录。
