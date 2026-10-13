# Docker 部署、升级与恢复

运行 Node.js/Express 应用与内置 Streamable HTTP MCP。MySQL 为真实存储；`merchant_integrations` 专表保存用户的薄荷连接密钥，随数据库备份恢复；`.runtime` 仅保留可显式迁移的旧配置。默认只绑定本机 127.0.0.1。无 Redis、无自动示例种子。端口 3200。

## 交付组合与验证范围

完整隔离验证使用 compose.yaml + compose.database.yaml 并施加与 compose.resources.yaml 一致的低资源覆盖；同时检查 app-only 组合可连接同一隔离网络内既有 MySQL。真实执行记录见 verification/docker-report.json。测试只使用合成数据，不访问生产原库，也不自动部署用户系统。

使用现有 MySQL 时只部署应用；不要创建替代业务库。资源覆盖仅用于低负载测试，需要结合实际负载评估。公网 DNS/证书及外部 MySQL 网络和凭据仍须在实际部署环境独立验收。

## 配置和首次启动

复制 `.env.example` 到项目外私有文件，设置至少12字符的 INITIAL_PASSWORD，首次迁移为test创建登录密码。可选APP_ACCESS_TOKEN/APP_READ_TOKEN仅导入test机器凭据，浏览器使用账号密码。其他用户自行注册并从账号设置创建个人接入凭据。`PUBLIC_URL` 必须与浏览器使用的完整 Origin 一致，例如 `http://localhost:3200`；此时不要用 `http://127.0.0.1:3200` 登录。令牌不进入镜像、Git 或项目包。

连接已有 MySQL：仅使用 `compose.yaml`，DB_HOST 为容器可达的数据库地址，宿主机数据库可使用 Docker Desktop 的 `host.docker.internal`。新建独立数据库：同时使用 `compose.database.yaml` 并设置 DB_HOST=db；该库与现有业务库不互相覆盖。

Compose 的 `--env-file` 用于 `${变量}` 插值，再通过 environment 传入容器；不是容器自动读取 .env。不要把真实私有配置放在构建上下文。

```text
docker compose --project-name meal-management --env-file <私有配置> -f compose.yaml -f compose.database.yaml -f compose.resources.yaml config --quiet
docker compose --project-name meal-management --env-file <私有配置> -f compose.yaml -f compose.database.yaml -f compose.resources.yaml build
docker compose --project-name meal-management --env-file <私有配置> -f compose.yaml -f compose.database.yaml -f compose.resources.yaml up -d --wait --wait-timeout 900 db
docker compose --project-name meal-management --env-file <私有配置> -f compose.yaml -f compose.database.yaml -f compose.resources.yaml run --rm --no-deps app node scripts/migrate.js
docker compose --project-name meal-management --env-file <私有配置> -f compose.yaml -f compose.database.yaml -f compose.resources.yaml up -d --wait --wait-timeout 180 app
docker compose --project-name meal-management --env-file <私有配置> -f compose.yaml -f compose.database.yaml -f compose.resources.yaml ps
```

已有数据库去掉第二个 `-f` 和启动 db 的步骤。迁移是增量建表与一次性工作台导入；保留原九表，不清理、不重播种。旧数据库若已有 merchant_workspace，不重复导入。应用账号须具备库内建表权限，已有库不需要全局权限。启动服务不代替迁移。

## 入口

- 页面：http://localhost:3200/；登录 `/login`，会话菜单可以退出。
- API：`/api/health`、`/api/merchant`、`/api/v1/*`。
- MCP：http://localhost:3200/mcp，Streamable HTTP；Bearer 令牌由客户端私有环境注入。
- 双图：`/diagrams/architecture.html`、`/diagrams/erd.html`，需要登录或 Bearer。
- 中文接口文档：`/docs/API中文说明.html`。活性 `/health/live` 与数据库就绪 `/health/ready` 不泄露业务记录。

## 更新、停机与回退

保留旧镜像的实际 sha256 ID，使用新版本标签构建。停止本项目全部写入者，先备份数据库与 runtime 卷，再独立运行 migrate.js。新服务健康后只读检查真实数据；不得在正式库写演示客户。原 Windows 服务切换时先核对所有权、停写，再占用同一端口。

停止用相同项目名/配置组合执行 `stop`；恢复用 `up -d --wait`。不执行 `down -v`，因为会删业务卷。0.4.0增加账号归属及复合键，禁止仅切换旧镜像读取当前多账号库。需恢复时先保留新库并评估新增用户数据，只能在独立库恢复旧备份作隔离验证，或前向修复。详见账号与数据隔离.md。

## 一致性备份与独立恢复

停写后，用数据库客户端 `mysqldump --single-transaction --set-gtid-purged=OFF` 导出指定库，密码通过 MYSQL_PWD 私有环境传入；不写在命令行。runtime 卷由本项目临时容器只读导出。将备份存放项目包外私有目录，记录哈希和时间。验证恢复必须导入另一个空库/独立卷，对比 merchant_workspace revision、payload 摘要和 api_requests 完整内容、merchant_integrations 私密配置内容；不覆盖生产演练。验收脚本在同一测试 MySQL 实例的独立库验证逻辑恢复，不声称跨主机灾备。

## 边界

非 root UID 1000，named volume 初次由镜像目录权限初始化；既有卷 UID 不符必须先验证/修复本项目卷。Linux 镜像支持 Docker Desktop Linux 引擎；Windows 中文目录绑定曾遇到文件共享阻塞，本交付静态文件通过 COPY。数据库首次启动给 900 秒窗口，失败查本项目日志。restart 策略不等于健康失效自动重启或高可用。公网 HTTPS、外部 MySQL 凭据及薄荷外部服务需按实际环境独立验收。

## 薄荷密钥随用户数据持久化

连接成功后写入 merchant_integrations（owner_id/provider复合主键，每账号独立）；credential不是加密存储，依赖数据库访问控制和私有备份保护，不进入工作台JSON、API/MCP响应或日志。先验证provider成功，再按配置版本原子写入；失败或并发版本冲突不会覆盖旧值。状态接口只返回configured/source/version和旧配置可迁移标记。

原.runtime/boohee.json 或 BOOHEE_API_KEY不会静默覆盖数据库：在连接窗口点击“迁移旧连接配置”，验证成功后仅首次插入；已有DB配置409。保留旧来源供恢复，后续均以DB为准。DB不可用返回503，不回退文件伪装可用。备份、恢复必须包括该私密表；公开项目包不得包含生产备份或密钥。真实薄荷在线验证需要有效用户Key，模拟provider只验证本系统流程，不代表外部服务已连通。

## HTTP 与 HTTPS 双入口

PUBLIC_URL 是主入口，ADDITIONAL_PUBLIC_URLS 是逗号分隔的额外可信来源，均精确匹配协议、域名和端口。例如主入口 https://meal.example.com，额外入口 http://example.com:13200。修改后用 Compose up -d 重新创建 app，单独 restart 不会更新容器环境变量。

登录、注册、退出、改密和浏览器API/MCP写请求均验证明确的可信来源；不信任任意Host或转发头。HTTPS入口的会话Cookie带Secure，HTTP入口不带Secure，二者都保留HttpOnly及SameSite=Strict。不同域名分别登录、共享同一账号数据；会话按浏览器入口单独建立。不能仅切换PUBLIC_URL就宣称原HTTP入口兼容。
HTTP/HTTPS分别使用meal_session_http与meal_session_https，避免同一浏览器的Secure同名Cookie保护导致HTTP登录循环。两个Cookie都不设置Domain。旧meal_session不再作为登录凭据读取，升级后旧浏览器会话需重新登录。

会话读取仅使用当前入口的协议 Cookie，不向另一协议回退。浏览器首次导航或 no-referrer 请求，使用配置中唯一匹配的 Host（含端口）识别；实际 TLS 与同入口 Referer 可提供明确协议依据。请保留反向代理的原始 Host；若两个协议被折叠为相同 Host 且代理抹掉协议证据，不能据此声称独立会话已支持。不会信任任意转发头或强制 HTTP 跳转 HTTPS。
