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
echo -e "\n=== Send Message ==="
curl -s -X POST "$BASE_URL/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $APP_TOKEN" \
  -d '{"title":"Hello","message":"This is a test message","priority":5}' | jq .

# ============================================
# 4. Get Messages
# ============================================
echo -e "\n=== Get Messages ==="
curl -s -X GET "$BASE_URL/message?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 5. Get Single Message
# ============================================
echo -e "\n=== Get Single Message (ID=1) ==="
curl -s -X GET "$BASE_URL/message/1" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 6. Delete Message
# ============================================
echo -e "\n=== Delete Message (ID=1) ==="
curl -s -X DELETE "$BASE_URL/message/1" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 7. List Applications
# ============================================
echo -e "\n=== List Applications ==="
curl -s -X GET "$BASE_URL/application" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 8. Delete Application
# ============================================
echo -e "\n=== Delete Application ==="
APP_ID=$(echo "$APP_RESPONSE" | jq -r '.id')
curl -s -X DELETE "$BASE_URL/application/$APP_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 9. Health Check
# ============================================
echo -e "\n=== Health Check ==="
curl -s "$BASE_URL/health" | jq .

# ============================================
# 10. List Plugins (Admin only)
# ============================================
echo -e "\n=== List Plugins ==="
curl -s -X GET "$BASE_URL/plugins" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ============================================
# 11. Enable Plugin
# ============================================
echo -e "\n=== Enable Plugin ==="
curl -s -X PUT "$BASE_URL/plugin/message-logger/enabled" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled":true}' | jq .
