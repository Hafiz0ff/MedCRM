#!/bin/bash
kill -9 $(lsof -t -i:3000) 2>/dev/null
kill -9 $(lsof -t -i:3001) 2>/dev/null

screen -XS medcrm-auth quit 2>/dev/null
screen -XS medcrm-gateway quit 2>/dev/null

screen -dmS medcrm-auth bash -lc "cd /Users/hafizov/MedCRM/backend && node dist/apps/auth-service/main.js"
screen -dmS medcrm-gateway bash -lc "cd /Users/hafizov/MedCRM/backend && node dist/apps/api-gateway/main.js"

echo "Restarted auth-service and api-gateway in screen sessions successfully!"
