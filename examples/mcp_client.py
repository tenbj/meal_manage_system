"""Python MCP SDK 只读示例：pip install mcp；令牌只通过环境注入。"""
import asyncio,os
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
async def main():
    async with streamablehttp_client(os.environ.get('MEAL_URL','http://localhost:3200')+'/mcp',headers={'Authorization':'Bearer '+os.environ['MEAL_TOKEN']}) as (reader,writer,_):
        async with ClientSession(reader,writer) as session:
            await session.initialize();print([t.name for t in (await session.list_tools()).tools])
            print(await session.call_tool('get_system_status',{}))
asyncio.run(main())
