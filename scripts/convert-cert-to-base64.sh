#!/bin/bash
# Helper script to convert Greenlight developer certificate files to base64
# Usage: ./scripts/convert-cert-to-base64.sh /path/to/cert.zip

if [ $# -eq 0 ]; then
    echo "Usage: $0 /path/to/greenlight-cert.zip"
    echo ""
    echo "This script extracts and converts the certificate files to base64"
    echo "Get your certificate from: https://blockstream.github.io/greenlight/getting-started/certs/"
    exit 1
fi

ZIP_FILE="$1"
TEMP_DIR=$(mktemp -d)

echo "Extracting certificate files..."
unzip -q "$ZIP_FILE" -d "$TEMP_DIR"

CERT_FILE="$TEMP_DIR/client.crt"
KEY_FILE="$TEMP_DIR/client-key.pem"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "Error: Expected client.crt and client-key.pem in the zip file"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo ""
echo "=== Add these to your .env file ==="
echo ""
echo "EXPO_PUBLIC_BREEZ_DEV_CERT_BASE64=$(cat "$CERT_FILE" | base64 | tr -d '\n')"
echo "EXPO_PUBLIC_BREEZ_DEV_KEY_BASE64=$(cat "$KEY_FILE" | base64 | tr -d '\n')"
echo ""
echo "Done! Copy the values above to your .env file or EAS environment variables."
rm -rf "$TEMP_DIR"
