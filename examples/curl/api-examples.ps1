# Miotify API Examples (PowerShell)

$BASE_URL = "http://localhost:8080/api"

# ============================================
# 1. Login
# ============================================
Write-Host "=== Login ===" -ForegroundColor Cyan
$loginBody = @{ name = "admin"; pass = "admin" } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri "$BASE_URL/login" -Method POST -Body $loginBody -ContentType "application/json"
$TOKEN = $loginRes.token
Write-Host "Token: $($TOKEN.Substring(0,20))..."

# ============================================
# 2. Create Application
# ============================================
Write-Host "`n=== Create Application ===" -ForegroundColor Cyan
$headers = @{ Authorization = "Bearer $TOKEN" }
$appBody = @{ name = "MyApp"; description = "Test application" } | ConvertTo-Json
$app = Invoke-RestMethod -Uri "$BASE_URL/application" -Method POST -Body $appBody -ContentType "application/json" -Headers $headers
Write-Host "App ID: $($app.id)"
Write-Host "App Token: $($app.token)"
$APP_TOKEN = $app.token

# ============================================
# 3. Send Message
# ============================================
Write-Host "`n=== Send Message ===" -ForegroundColor Cyan
$appHeaders = @{ Authorization = "Bearer $APP_TOKEN" }
$msgBody = @{ title = "Hello"; message = "This is a test message"; priority = 5 } | ConvertTo-Json
$msg = Invoke-RestMethod -Uri "$BASE_URL/message" -Method POST -Body $msgBody -ContentType "application/json" -Headers $appHeaders
Write-Host "Message ID: $($msg.id)"
Write-Host "Title: $($msg.title)"

# ============================================
# 4. Get Messages
# ============================================
Write-Host "`n=== Get Messages ===" -ForegroundColor Cyan
$messages = Invoke-RestMethod -Uri "$BASE_URL/message?limit=10" -Method GET -Headers $headers
Write-Host "Total: $($messages.messages.Count) messages"
foreach ($m in $messages.messages) {
    Write-Host "  - [$($m.priority)] $($m.title): $($m.message)"
}

# ============================================
# 5. Delete Message
# ============================================
Write-Host "`n=== Delete Message ===" -ForegroundColor Cyan
$deleteRes = Invoke-RestMethod -Uri "$BASE_URL/message/$($msg.id)" -Method DELETE -Headers $headers
Write-Host $deleteRes.message

# ============================================
# 6. Health Check
# ============================================
Write-Host "`n=== Health Check ===" -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method GET
Write-Host "Status: $($health.status)"
Write-Host "WebSocket connections: $($health.websocket)"

# ============================================
# 7. List Plugins
# ============================================
Write-Host "`n=== List Plugins ===" -ForegroundColor Cyan
$plugins = Invoke-RestMethod -Uri "$BASE_URL/plugins" -Method GET -Headers $headers
foreach ($p in $plugins) {
    $status = if ($p.enabled) { "enabled" } else { "disabled" }
    Write-Host "  - $($p.name) ($($p.id)): $status"
}

Write-Host "`n=== Done ===" -ForegroundColor Green
