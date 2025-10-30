#!/bin/bash

# Timesheet Application - Authentication Test Script
# This script tests all user authentications and shows clear error messages

BASE_URL="http://localhost:4004"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Timesheet Application Auth Tester${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to test authentication
test_auth() {
    local username=$1
    local password=$2
    local role=$3
    local endpoint=$4
    
    echo -e "${YELLOW}Testing: ${role} - ${username}${NC}"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -u "${username}:${password}" "${BASE_URL}${endpoint}")
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ SUCCESS: ${username} authenticated successfully${NC}"
        return 0
    elif [ "$response" = "401" ]; then
        echo -e "${RED}✗ FAILED: ${username} - Invalid credentials (401 Unauthorized)${NC}"
        echo -e "  Username: ${username}"
        echo -e "  Password: ${password}"
        echo -e "  Endpoint: ${endpoint}"
        return 1
    elif [ "$response" = "403" ]; then
        echo -e "${RED}✗ FAILED: ${username} - Access forbidden (403 Forbidden)${NC}"
        echo -e "  User authenticated but lacks permission for: ${endpoint}"
        return 1
    elif [ "$response" = "000" ]; then
        echo -e "${RED}✗ FAILED: Cannot connect to server${NC}"
        echo -e "  Make sure the server is running: cds watch"
        return 1
    else
        echo -e "${RED}✗ FAILED: ${username} - HTTP ${response}${NC}"
        return 1
    fi
    echo ""
}

# Check if server is running
echo -e "${YELLOW}Checking if server is running...${NC}"
if curl -s "${BASE_URL}" > /dev/null; then
    echo -e "${GREEN}✓ Server is running${NC}\n"
else
    echo -e "${RED}✗ Server is NOT running!${NC}"
    echo -e "  Please start the server with: ${YELLOW}cds watch${NC}\n"
    exit 1
fi

# Test Employees
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing EMPLOYEE Users (8 users)${NC}"
echo -e "${BLUE}========================================${NC}\n"

test_auth "john.smith" "initial" "Employee 1" "/odata/v4/employee/MyProfile"
test_auth "alice.brown" "initial" "Employee 2" "/odata/v4/employee/MyProfile"
test_auth "robert.davis" "initial" "Employee 3" "/odata/v4/employee/MyProfile"
test_auth "emma.wilson" "initial" "Employee 4" "/odata/v4/employee/MyProfile"
test_auth "james.miller" "initial" "Employee 5" "/odata/v4/employee/MyProfile"
test_auth "sophia.garcia" "initial" "Employee 6" "/odata/v4/employee/MyProfile"
test_auth "william.martinez" "initial" "Employee 7" "/odata/v4/employee/MyProfile"
test_auth "olivia.lee" "initial" "Employee 8" "/odata/v4/employee/MyProfile"

# Test Managers
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing MANAGER Users (2 users)${NC}"
echo -e "${BLUE}========================================${NC}\n"

test_auth "sarah.johnson" "initial" "Manager 1" "/odata/v4/manager/MyManagerProfile"
test_auth "michael.chen" "initial" "Manager 2" "/odata/v4/manager/MyManagerProfile"

# Test Admin
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing ADMIN User (1 user)${NC}"
echo -e "${BLUE}========================================${NC}\n"

test_auth "admin" "initial" "Administrator" "/odata/v4/admin/Employees"

# Test Wrong Credentials
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing INVALID Credentials${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Testing wrong password...${NC}"
test_auth "john.smith" "wrong_password" "Employee (Invalid)" "/odata/v4/employee/MyProfile"

echo -e "${YELLOW}Testing wrong username...${NC}"
test_auth "wrong.user" "initial" "Unknown User" "/odata/v4/employee/MyProfile"

# Test Cross-Role Access
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing CROSS-ROLE Access (Should Fail)${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Employee trying to access Manager endpoint...${NC}"
test_auth "john.smith" "initial" "Employee → Manager" "/odata/v4/manager/MyTeam"

echo -e "${YELLOW}Employee trying to access Admin endpoint...${NC}"
test_auth "john.smith" "initial" "Employee → Admin" "/odata/v4/admin/Employees"

echo -e "${YELLOW}Manager trying to access Admin endpoint...${NC}"
test_auth "sarah.johnson" "initial" "Manager → Admin" "/odata/v4/admin/Employees"

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  Authentication Test Complete${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${GREEN}All users have the same password: ${YELLOW}initial${NC}"
echo -e "${GREEN}Total test users: ${YELLOW}11${NC} (8 Employees + 2 Managers + 1 Admin)\n"

echo -e "${YELLOW}Quick Access URLs:${NC}"
echo -e "  Employee: ${BASE_URL}/odata/v4/employee"
echo -e "  Manager:  ${BASE_URL}/odata/v4/manager"
echo -e "  Admin:    ${BASE_URL}/odata/v4/admin\n"

echo -e "${YELLOW}To test in browser:${NC}"
echo -e "  1. Open: ${BASE_URL}/odata/v4/employee"
echo -e "  2. Enter username: john.smith"
echo -e "  3. Enter password: initial\n"

echo -e "${YELLOW}To clear browser credentials:${NC}"
echo -e "  - Use Private/Incognito window"
echo -e "  - Or clear browser cache and cookies\n"