import requests
import asyncio
import websockets
import json

BASE_URL = 'http://localhost:8080/api'
WS_URL = 'ws://localhost:8080/ws'

def login(username, password):
    res = requests.post(f'{BASE_URL}/login', json={'name': username, 'pass': password})
    res.raise_for_status()
    return res.json()

async def listen_messages(token):
    uri = WS_URL
    print('   Connecting to WebSocket...')
    # token 通过 Sec-WebSocket-Protocol 子协议传递（避免出现在 URL query 中被日志记录）
    async with websockets.connect(uri, subprotocols=['miotify', token]) as ws:
        print('   WebSocket connected\n')
        print('3. Listening for messages...')
        print('   (Send a message to your app to see it here)')
        print('   Press Ctrl+C to exit\n')
        
        async for message in ws:
            data = json.loads(message)
            if data['type'] == 'connected':
                print(f"   Connected as user ID: {data['data']['id']}")
            elif data['type'] == 'message':
                msg = data['data']
                print(f"\n   New message received:")
                print(f"   - App ID: {msg['appid']}")
                print(f"   - Title: {msg['title']}")
                print(f"   - Message: {msg['message']}")
                print(f"   - Priority: {msg['priority']}")

async def main():
    print('=== Miotify WebSocket Example ===\n')

    print('1. Login')
    login_res = login('admin', 'admin')
    print('   Token received')
    token = login_res['token']

    print('\n2. Connect WebSocket')
    await listen_messages(token)

if __name__ == '__main__':
    asyncio.run(main())
