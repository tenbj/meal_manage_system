import json
print(json.dumps({'mcpServers':{'meal':{'url':'http://localhost:3200/mcp','transport':'streamable-http','headers':{'Authorization':'Bearer <从客户端私有环境读取>'}}}},ensure_ascii=False,indent=2))
