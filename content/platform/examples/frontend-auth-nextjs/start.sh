#!/bin/bash

echo "🌋 Volcano Frontend Auth - Next.js"
echo "=================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from template..."
    cp .env.example .env.local
    echo ""
    echo "⚠️  IMPORTANT: Edit .env.local with your Volcano credentials:"
    echo "   - NEXT_PUBLIC_VOLCANO_API_URL"
    echo "   - NEXT_PUBLIC_VOLCANO_PROJECT_ID"
    echo "   - NEXT_PUBLIC_VOLCANO_ANON_KEY"
    echo ""
    read -p "Press Enter once you've configured .env.local..."
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    yarn install
    echo ""
fi

echo "🚀 Starting Next.js development server on port 3001..."
echo "📍 Open: http://localhost:3001"
echo ""
echo "Available commands:"
echo "  yarn dev        - Development server"
echo "  yarn build      - Production build"
echo "  yarn lint       - Run linter"
echo "  yarn type-check - TypeScript check"
echo ""

yarn dev
