#!/bin/bash

# Secure Clipboard - Startup Script
# This script:
# 1. Starts Docker Compose services (PostgreSQL + Redis)
# 2. Waits for health checks
# 3. Runs Spring Boot application

set -e  # Exit on error

echo "Starting Secure Clipboard Application..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Start Docker Compose
echo -e "${YELLOW}[1/3] Starting Docker Compose services...${NC}"
docker compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to start Docker Compose services${NC}"
    exit 1
fi

echo -e "${GREEN}Docker Compose services started${NC}"
echo ""

# Step 2: Wait for services to be ready
echo -e "${YELLOW}[2/3] Waiting for services to be healthy...${NC}"

# Wait for PostgreSQL
echo "Checking PostgreSQL..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker exec secure-clipboard-db pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}PostgreSQL is ready${NC}"
        break
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    echo "  Waiting for PostgreSQL... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}PostgreSQL failed to start after $MAX_ATTEMPTS attempts${NC}"
    exit 1
fi

# Wait for Redis
echo "Checking Redis..."
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker exec secure-clipboard-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}Redis is ready${NC}"
        break
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    echo "  Waiting for Redis... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}Redis failed to start after $MAX_ATTEMPTS attempts${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}All services are healthy${NC}"
echo ""

# Step 3: Start Spring Boot
echo -e "${YELLOW}[3/3] Starting Spring Boot application...${NC}"
echo ""

mvn spring-boot:run

