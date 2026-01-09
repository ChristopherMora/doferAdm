#!/bin/bash

echo "🧪 Testing DOFER Panel Frontend"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

FRONTEND_URL="http://localhost:3000"
BACKEND_URL="http://localhost:9000"

# Test 1: Frontend is running
echo "1️⃣  Testing Frontend Server..."
if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" | grep -q "200"; then
    echo -e "${GREEN}✓${NC} Frontend running at $FRONTEND_URL"
else
    echo -e "${RED}✗${NC} Frontend not running"
    exit 1
fi

# Test 2: Backend is running
echo ""
echo "2️⃣  Testing Backend API..."
HEALTH_CHECK=$(curl -s "$BACKEND_URL/health")
if echo "$HEALTH_CHECK" | grep -q "ok"; then
    echo -e "${GREEN}✓${NC} Backend API running at $BACKEND_URL"
    echo "   Response: $HEALTH_CHECK"
else
    echo -e "${RED}✗${NC} Backend API not responding"
    exit 1
fi

# Test 3: Backend orders endpoint
echo ""
echo "3️⃣  Testing Orders API..."
ORDERS=$(curl -s -H "Authorization: Bearer test-token" "$BACKEND_URL/api/v1/orders")
ORDER_COUNT=$(echo "$ORDERS" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
if [ ! -z "$ORDER_COUNT" ]; then
    echo -e "${GREEN}✓${NC} Orders endpoint working - $ORDER_COUNT orders found"
else
    echo -e "${RED}✗${NC} Orders endpoint failed"
    exit 1
fi

# Test 4: Check if pages are accessible
echo ""
echo "4️⃣  Testing Frontend Pages..."

# Test login page
if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/login" | grep -q "200"; then
    echo -e "${GREEN}✓${NC} Login page accessible: /login"
else
    echo -e "${RED}✗${NC} Login page not accessible"
fi

# Test dashboard (will redirect to login without auth, but should not 404)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/dashboard")
if [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Dashboard page exists: /dashboard (redirects without auth)"
else
    echo -e "${YELLOW}⚠${NC}  Dashboard page status: $HTTP_CODE"
fi

# Summary
echo ""
echo "================================"
echo -e "${GREEN}✅ Frontend Tests Completed${NC}"
echo ""
echo "📋 Manual Tests to Perform:"
echo "   1. Open browser: $FRONTEND_URL"
echo "   2. Click 'Iniciar sesión'"
echo "   3. Try login (will fail without real Supabase config)"
echo "   4. Check API connection from browser console"
echo ""
echo "💡 Note: Authentication requires Supabase configuration"
echo "   For now, the frontend connects to backend with test-token"
