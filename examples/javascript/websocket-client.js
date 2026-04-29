const BASE_URL = 'http://localhost:8080/api';
const WS_URL = 'ws://localhost:8080/ws';

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: username, pass: password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return res.json();
}

function connectWebSocket(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      console.log('   WebSocket connected');
      resolve(ws);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'connected') {
        console.log(`   Connected as user ID: ${data.data.id}`);
      } else if (data.type === 'message') {
        const msg = data.data;
        console.log(`\n   New message received:`);
        console.log(`   - App ID: ${msg.appid}`);
        console.log(`   - Title: ${msg.title}`);
        console.log(`   - Message: ${msg.message}`);
        console.log(`   - Priority: ${msg.priority}`);
      }
    };

    ws.onerror = (err) => {
      console.error('   WebSocket error:', err);
      reject(err);
    };

    ws.onclose = (event) => {
      console.log(`   WebSocket closed: ${event.code} ${event.reason}`);
    };
  });
}

async function main() {
  console.log('=== Miotify WebSocket Example ===\n');

  console.log('1. Login');
  const loginRes = await login('admin', 'admin');
  console.log(`   Token received`);
  const token = loginRes.token;

  console.log('\n2. Connect WebSocket');
  const ws = await connectWebSocket(token);

  console.log('\n3. Listening for messages...');
  console.log('   (Send a message to your app to see it here)');
  console.log('   Press Ctrl+C to exit\n');
}

main().catch(console.error);
