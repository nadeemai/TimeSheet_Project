#!/bin/bash
# =====================================================
# Script : load-default-env.sh
# Purpose: Load default-env.json from CF for CAPM services
# Author : SuMoDigitech
# =====================================================

SERVICE_NAME="timesheet-application-srv"   # Change to your CAPM service name
PLUGIN_NAME="DefaultEnv"

# Step 0: Check CF login status
echo -e "\n🔎 Checking Cloud Foundry login status..."
if ! cf oauth-token > /dev/null 2>&1; then
    echo -e "\n\e[1;33m🔐 You are not logged in to Cloud Foundry. Please login...\e[0m"
    cf login --sso
else
    echo -e "\e[1;32m✅ You are already logged in to Cloud Foundry.\e[0m"
fi

# Step 1: Check if DefaultEnv plugin is installed
echo -e "\n🔎 Checking for CF plugin: $PLUGIN_NAME ..."
if ! cf plugins | grep -q "$PLUGIN_NAME"; then
    echo -e "\e[1;34m📦 Installing plugin $PLUGIN_NAME ...\e[0m"
    cf install-plugin $PLUGIN_NAME -r CF-Community -f
else
    echo -e "\e[1;32m✅ Plugin $PLUGIN_NAME is already installed.\e[0m"
fi

# Step 2: Load default-env.json for the service
echo -e "\n⚡ Loading default-env.json for service: $SERVICE_NAME ..."
if cf default-env "$SERVICE_NAME"; then
    echo -e "\e[1;32m✅ Successfully loaded default-env.json for $SERVICE_NAME\e[0m"
else
    echo -e "\e[1;31m❌ Failed to load default-env.json. Try re-authenticating with 'cf login'.\e[0m"
    exit 1
fi

# Step 3: Final message
echo -e "\n🎉 Done! Your CAPM service default-env.json is ready."
