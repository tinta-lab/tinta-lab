#!/usr/bin/env bash
# Tinta Lab — New Client Provisioning
# Usage: ./scripts/provision-client.sh
# Or with env vars: ADMIN_EMAIL=admin@tinta-lab.de ADMIN_PASS=... ./scripts/provision-client.sh
#
# Requires: curl, jq
set -euo pipefail

API="${TINTA_API:-https://api.tinta-lab.de}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASS="${ADMIN_PASS:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      Tinta Lab — New Client Provisioning     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo

# ── Step 1: Admin login ─────────────────────────────────────────────────────
if [[ -z "$ADMIN_EMAIL" ]]; then
  read -rp "Admin email: " ADMIN_EMAIL
fi
if [[ -z "$ADMIN_PASS" ]]; then
  read -rsp "Admin password: " ADMIN_PASS; echo
fi

echo -e "\n${CYAN}Authenticating...${NC}"
AUTH=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}") || {
  echo -e "${RED}Auth failed — check credentials and API URL ($API)${NC}"; exit 1
}
TOKEN=$(echo "$AUTH" | jq -r '.access_token')
echo -e "${GREEN}✓ Authenticated${NC}"

# ── Step 2: Client info ──────────────────────────────────────────────────────
echo
echo -e "${BOLD}━━━  Client Details  ━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
read -rp "First name:        " FIRST_NAME
read -rp "Last name:         " LAST_NAME
read -rp "Email:             " CLIENT_EMAIL
read -rsp "Password:          " CLIENT_PASS; echo
read -rp "Phone (+49...):    " PHONE
read -rp "City:              " CITY

echo
echo -e "${BOLD}━━━  Home Assistant Setup  ━━━━━━━━━━━━━━━━━━━${NC}"
read -rp "Server name (e.g. Mueller Home): " SERVER_NAME
read -rp "Subdomain prefix (e.g. mueller): " SUBDOMAIN
echo
echo -e "${CYAN}Deployment mode:${NC}"
echo "  1) HA Add-on (agent runs inside Home Assistant)"
echo "  2) Standalone (Docker / PM2 on separate machine)"
read -rp "Choice [1/2]: " DEPLOY_MODE

# ── Step 3: Provision ────────────────────────────────────────────────────────
echo
echo -e "${CYAN}Provisioning client...${NC}"
RESULT=$(curl -sf -X POST "$API/provisioning/client" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$CLIENT_EMAIL\",
    \"password\": \"$CLIENT_PASS\",
    \"firstName\": \"$FIRST_NAME\",
    \"lastName\": \"$LAST_NAME\",
    \"phone\": \"$PHONE\",
    \"city\": \"$CITY\",
    \"serverName\": \"$SERVER_NAME\",
    \"subdomain\": \"$SUBDOMAIN\"
  }") || {
  echo -e "${RED}Provisioning failed. Check if email already exists.${NC}"; exit 1
}

CLIENT_ID=$(echo "$RESULT" | jq -r '.clientId')
AGENT_TOKEN=$(echo "$RESULT" | jq -r '.agentToken')
INSTALL_URL=$(echo "$RESULT" | jq -r '.installUrl // empty')
DASHBOARD_URL=$(echo "$RESULT" | jq -r '.dashboardUrl')
TUNNEL_TOKEN=$(echo "$RESULT" | jq -r '.tunnelToken // empty')

echo -e "${GREEN}✓ Client provisioned successfully!${NC}"

# ── Step 4: Output ───────────────────────────────────────────────────────────
echo
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║           PROVISIONING RESULT                ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo
echo -e "${BOLD}Client Credentials (send to client):${NC}"
echo -e "  Dashboard: ${CYAN}https://app.tinta-lab.de${NC}"
echo -e "  Email:     ${CYAN}$CLIENT_EMAIL${NC}"
echo -e "  Password:  ${CYAN}$CLIENT_PASS${NC}"
echo
echo -e "${BOLD}Home Assistant URL:${NC}"
echo -e "  ${CYAN}$DASHBOARD_URL${NC}"
echo
if [[ -n "$INSTALL_URL" ]]; then
echo -e "${BOLD}Magic Install Link (valid 48h):${NC}"
echo -e "  ${CYAN}${GREEN}$INSTALL_URL${NC}"
echo -e "  ${CYAN}Send this to the client — all config is pre-filled.${NC}"
echo
fi
echo -e "${BOLD}IDs (save these):${NC}"
echo -e "  Client ID:   $CLIENT_ID"
echo -e "  Agent Token: $AGENT_TOKEN"

# ── Step 5: Generate config file ────────────────────────────────────────────
OUT_FILE="./client-${SUBDOMAIN}-config.txt"

{
echo "═══════════════════════════════════════════════════════"
echo "  Tinta Lab — Client: $FIRST_NAME $LAST_NAME ($CLIENT_EMAIL)"
echo "  Provisioned: $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════════════"
echo
echo "CLIENT CREDENTIALS"
echo "  URL:      https://app.tinta-lab.de"
echo "  Email:    $CLIENT_EMAIL"
echo "  Password: $CLIENT_PASS"
echo
echo "HOME ASSISTANT"
echo "  URL: $DASHBOARD_URL"
echo
if [[ -n "$INSTALL_URL" ]]; then
echo "MAGIC INSTALL LINK (valid 48h)"
echo "  $INSTALL_URL"
echo "  Send this link to the client — all agent config is pre-filled."
echo
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ "$DEPLOY_MODE" == "1" ]]; then
echo
echo "HA ADD-ON CONFIGURATION"
echo "  After installing 'Tinta Agent' add-on, set these options:"
echo
echo "  tinta_client_id:    $CLIENT_ID"
echo "  tinta_agent_token:  $AGENT_TOKEN"
echo "  tinta_core_ws:      wss://api.tinta-lab.de/tinta/ws"
echo "  tinta_external_url: $DASHBOARD_URL"

if [[ -n "$TUNNEL_TOKEN" ]]; then
echo
echo "CLOUDFLARE TUNNEL"
echo "  Install cloudflared on the server and run:"
echo "  cloudflared tunnel run --token $TUNNEL_TOKEN"
fi

else
echo
echo "STANDALONE AGENT — ecosystem.config.js"
echo
cat <<ECOSYSTEM
module.exports = {
  apps: [{
    name: 'tinta-agent-$(echo "$SUBDOMAIN" | tr '.' '-')',
    script: 'dist/agent.js',
    cwd: '/opt/tinta-agent/tinta_agent',
    restart_delay: 5000,
    max_restarts: 20,
    env: {
      TINTA_CLIENT_ID:    '$CLIENT_ID',
      TINTA_AGENT_TOKEN:  '$AGENT_TOKEN',
      TINTA_CORE_WS:      'wss://api.tinta-lab.de/tinta/ws',
      TINTA_EXTERNAL_URL: '$DASHBOARD_URL',
      HA_HOST:            '$DASHBOARD_URL',
      HA_PORT:            '443',
      HA_SSL:             'true',
      SUPERVISOR_TOKEN:   '<PASTE_HA_LONG_LIVED_TOKEN_HERE>',
    },
  }],
};
ECOSYSTEM

if [[ -n "$TUNNEL_TOKEN" ]]; then
echo
echo "CLOUDFLARE TUNNEL"
echo "  cloudflared tunnel run --token $TUNNEL_TOKEN"
fi

echo
echo "NOTES:"
echo "  SUPERVISOR_TOKEN = HA Long-Lived Access Token"
echo "  Create it in HA → Profile → Long-Lived Access Tokens"
fi

echo
echo "═══════════════════════════════════════════════════════"
} > "$OUT_FILE"

echo
echo -e "${GREEN}✓ Config saved to: ${BOLD}$OUT_FILE${NC}"
echo -e "${CYAN}  Share the client credentials section with $FIRST_NAME $LAST_NAME.${NC}"
echo
