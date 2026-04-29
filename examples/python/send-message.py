import requests
import json

BASE_URL = 'http://localhost:8080/api'

def login(username, password):
    res = requests.post(f'{BASE_URL}/login', json={'name': username, 'pass': password})
    res.raise_for_status()
    return res.json()

def create_application(token, name, description=''):
    headers = {'Authorization': f'Bearer {token}'}
    res = requests.post(f'{BASE_URL}/application', json={'name': name, 'description': description}, headers=headers)
    res.raise_for_status()
    return res.json()

def send_message(app_token, title, message, priority=0):
    headers = {'Authorization': f'Bearer {app_token}'}
    res = requests.post(f'{BASE_URL}/message', json={'title': title, 'message': message, 'priority': priority}, headers=headers)
    res.raise_for_status()
    return res.json()

def get_messages(token, limit=100):
    headers = {'Authorization': f'Bearer {token}'}
    res = requests.get(f'{BASE_URL}/message?limit={limit}', headers=headers)
    res.raise_for_status()
    return res.json()

def main():
    print('=== Miotify Python Example ===\n')

    print('1. Login')
    login_res = login('admin', 'admin')
    print(f"   Token: {login_res['token'][:20]}...")
    token = login_res['token']

    print('\n2. Create application')
    app = create_application(token, 'MyPythonApp', 'Python example application')
    print(f"   App ID: {app['id']}")
    print(f"   App Token: {app['token']}")
    app_token = app['token']

    print('\n3. Send messages')
    send_message(app_token, 'Hello from Python', 'This is a test message from Python', 0)
    print('   Message 1 sent')
    send_message(app_token, 'Alert', 'High priority alert from Python!', 5)
    print('   Message 2 sent')

    print('\n4. Get messages')
    messages = get_messages(token)
    print(f"   Total: {len(messages['messages'])} messages")
    for m in messages['messages']:
        print(f"   - [{m['priority']}] {m['title']}: {m['message']}")

    print('\n=== Done ===')

if __name__ == '__main__':
    main()
