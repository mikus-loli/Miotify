# Miotify API Examples (curl)

BASE_URL="http://localhost:8080/api"

# ============================================
# 1. Login
# ============================================
echo "=== Login ==="
TOKEN=$(curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{"name":"admin","pass":"admin"}' | jq -r '.token')
echo "Token: ${TOKEN:0:20}..."

# ============================================
# 2. Create Application
# ============================================
echo -e "\n=== Create Application ==="
APP_RESPONSE=$(curl -s -X POST "$BASE_URL/application" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"MyApp","description":"Test application"}')
echo "$APP_RESPONSE" | jq .
APP_TOKEN=$(echo "$APP_RESPONSE" | jq -r '.token')

# ============================================
# 3. Send Message (using app token)
# ============================================
echo -e "\n=== Send Message ===\n"
# 发送消息必须使用 App Token（不是登录 JWT）
curl -s -X POST "$BASE_URL/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $APP_TOKEN" \
  -d '{"title":"Hello","message":"This is a test message","priority":5}' | jq .

# ============================================
# 4. Get Messages
# ============================================
echo -e "\n=== Get Messages ===\n"
curl -s -X GET "$BASE_URL/message?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 5. Get Single Message
# ============================================
echo -e "\n=== Get Single Message (ID=1) ===\n"
curl -s -X GET "$BASE_URL/message/1" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 6. Delete Message
# ============================================
echo -e "\n=== Delete Message (ID=1) ===\n"
curl -s -X DELETE "$BASE_URL/message/1" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 7. List Applications
# ============================================
echo -e "\n=== List Applications ===\n"
curl -s -X GET "$BASE_URL/application" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 8. Delete Application
# ============================================
echo -e "\n=== Delete Application ===\n"
APP_ID=$(echo "$APP_RESPONSE" | jq -r '.id')
curl -s -X DELETE "$BASE_URL/application/$APP_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 9. Health Check
# ============================================
echo -e "\n=== Health Check ===\n"
# 注意：/health 挂在根路径（不在 /api 前缀下），与 Gotify 官方一致
curl -s "http://localhost:8080/health" | jq .

# ============================================
# 10. List Plugins (Admin only)
# ============================================
echo -e "\n=== List Plugins ===\n"
curl -s -X GET "$BASE_URL/plugins" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 11. Enable Plugin
# ============================================
echo -e "\n=== Enable Plugin ===\n"
curl -s -X PUT "$BASE_URL/plugin/email-forwarder/enabled" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled":true}' | jq .

# ============================================
# 12. Gotify 兼容端点示例（青龙等客户端常用，根路径无需 /api 前缀）
# ============================================
echo -e "\n=== Gotify: Send Message (root path) ===\n"
curl -s -X POST "http://localhost:8080/message" \
  -H "Content-Type: application/json" \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{"title":"Gotify","message":"Compatible endpoint works","priority":0}' | jq .
