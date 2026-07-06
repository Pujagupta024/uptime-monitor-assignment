#!/bin/bash

echo "Wait for backend to be healthy..."
while ! curl -s http://localhost:8000/api/urls > /dev/null; do
    sleep 1
done
echo "Backend is healthy."

echo "Registering healthy URL..."
curl -s -X POST -H "Content-Type: application/json" -d '{"url":"https://example.com"}' http://localhost:8000/api/urls
echo ""

echo "Registering broken URL..."
curl -s -X POST -H "Content-Type: application/json" -d '{"url":"https://this-domain-does-not-exist-at-all-xyz.com"}' http://localhost:8000/api/urls
echo ""

echo "Sleeping for 7 seconds to let background worker ping..."
sleep 7

echo "Fetching metrics..."
RESPONSE=$(curl -s http://localhost:8000/api/urls)
echo $RESPONSE

if echo "$RESPONSE" | grep -q '"is_up":true' && echo "$RESPONSE" | grep -q '"is_up":false'; then
    echo -e "\n✅ Success! Both true and false is_up states detected."
    exit 0
else
    echo -e "\n❌ Failed to detect both up and down states."
    exit 1
fi
