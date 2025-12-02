#!/bin/bash

# Set working directory to script location
cd "$(dirname "$0")"

# Tweego binary path
TWEEGO_BIN="$(pwd)/devTools/tweego_mac/tweego"

# Tweego storyformats path
export TWEEGO_PATH="$(pwd)/devTools/tweego_mac/storyformats"

echo "====================================="
echo "Interactive Story - Compiler"
echo "====================================="
echo ""

# Ensure dist directory exists
if [ ! -d "dist" ]; then
    mkdir -p dist
fi

echo "[1/2] Checking source directory..."
echo "  Source: $(pwd)/game"
echo ""

echo "[2/2] Compiling with Tweego..."
echo ""

# Check if tweego binary exists
if [ ! -f "$TWEEGO_BIN" ]; then
    echo "Error: tweego binary not found at $TWEEGO_BIN"
    echo "Please ensure the Mac version of tweego is in devTools/tweego_mac/"
    exit 1
fi

# Make sure it's executable
chmod +x "$TWEEGO_BIN" 2>/dev/null

# Compile with Tweego, using game/ as source root and head.html for <head>
"$TWEEGO_BIN" \
    -f sugarcube-2.36.1 \
    --head "$(pwd)/devTools/head.html" \
    -o "$(pwd)/dist/game.html" \
    "$(pwd)/game"

if [ $? -eq 0 ]; then
    echo ""
    echo "====================================="
    echo "Build successful!"
    echo "====================================="
    echo ""
    echo "Output: dist/game.html"
    echo ""
else
    echo ""
    echo "====================================="
    echo "Build failed!"
    echo "====================================="
    echo ""
    exit 1
fi

