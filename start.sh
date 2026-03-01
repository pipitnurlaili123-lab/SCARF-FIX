#!/bin/bash
# ╔══════════════════════════════════════════════════════╗
# ║   ♾️  INFINITY BOT V9 — ONE LINE SETUP & START  ♾️   ║
# ╚══════════════════════════════════════════════════════╝
#
# RUN KARO:
#   bash start.sh
#
# YA EK LINE MEIN:
#   npm install && pip install yt-dlp --break-system-packages ; node infinity_bot_v9_final.js

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   ♾️   INFINITY BOT V9 — SETUP   ♾️   ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Node.js check ──
if ! command -v node &>/dev/null; then
  echo "❌ Node.js nahi mila! Install: https://nodejs.org (v18+)"
  exit 1
fi
NODE_VER=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌ Node.js v18+ chahiye. Current: $(node -v)"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# ── npm packages ──
echo "📦 npm packages install ho rahi hain..."
npm install
echo "✅ npm packages done"

# ── yt-dlp ──
echo "📦 yt-dlp install ho raha hai..."
pip install yt-dlp --break-system-packages 2>/dev/null \
  || pip install yt-dlp 2>/dev/null \
  || pip3 install yt-dlp 2>/dev/null \
  || echo "⚠️  yt-dlp install nahi hua (music/video kaam nahi karega)"

# ── Data folders ──
mkdir -p data data/backups
echo "✅ data/ folder ready"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      🚀  BOT START HO RAHA HAI!      ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "💡 Band karne ke liye: Ctrl + C"
echo ""

node infinity_bot_v9_final.js
