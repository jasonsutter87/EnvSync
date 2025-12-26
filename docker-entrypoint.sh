#!/bin/sh
set -e

# Runtime configuration for Angular
# Replace environment placeholders in built JavaScript files

# Create runtime config from environment variables
cat > /usr/share/nginx/html/assets/config.json << EOF
{
  "apiUrl": "${API_URL:-http://localhost:8000}",
  "veilcloudUrl": "${VEILCLOUD_URL:-https://api.veilcloud.io}",
  "features": {
    "sync": ${FEATURE_SYNC:-true},
    "teams": ${FEATURE_TEAMS:-true},
    "integrations": ${FEATURE_INTEGRATIONS:-true}
  }
}
EOF

echo "Runtime config generated:"
cat /usr/share/nginx/html/assets/config.json

exec "$@"
