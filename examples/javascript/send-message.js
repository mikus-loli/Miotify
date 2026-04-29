const BASE_URL = 'http://localhost:8080/api';

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: username, pass: password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return res.json();
}

async function createApplication(token, name, description = '') {
  const res = await fetch(`${BASE_URL}/application`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error(`Create application failed: ${res.status}`);
  return res.json();
}

async function sendMessage(appToken, title, message, priority = 0) {
  const res = await fetch(`${BASE_URL}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${appToken}`,
    },
    body: JSON.stringify({ title, message, priority }),
  });
  if (!res.ok) throw new Error(`Send message failed: ${res.status}`);
  return res.json();
}

async function getMessages(token, limit = 100) {
  const res = await fetch(`${BASE_URL}/message?limit=${limit}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Get messages failed: ${res.status}`);
  return res.json();
}

async function main() {
  console.log('=== Miotify JavaScript Example ===\n');

  console.log('1. Login');
  const loginRes = await login('admin', 'admin');
  console.log(`   Token: ${loginRes.token.substring(0, 20)}...`);
  const token = loginRes.token;

  console.log('\n2. Create application');
  const app = await createApplication(token, 'MyApp', 'Example application');
  console.log(`   App ID: ${app.id}`);
  console.log(`   App Token: ${app.token}`);
  const appToken = app.token;

  console.log('\n3. Send messages');
  await sendMessage(appToken, 'Hello', 'This is a test message', 0);
  console.log('   Message 1 sent');
  await sendMessage(appToken, 'Alert', 'High priority alert!', 5);
  console.log('   Message 2 sent');

  console.log('\n4. Get messages');
  const messages = await getMessages(token);
  console.log(`   Total: ${messages.messages.length} messages`);
  messages.messages.forEach(m => {
    console.log(`   - [${m.priority}] ${m.title}: ${m.message}`);
  });

  console.log('\n=== Done ===');
}

main().catch(console.error);
