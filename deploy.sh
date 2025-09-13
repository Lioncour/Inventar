#!/bin/bash

# Deploy script for Inventar
# This script helps with local development and deployment

echo "🚀 Inventar Deployment Script"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found. Please run this script from the project root."
    exit 1
fi

# Create images directory if it doesn't exist
if [ ! -d "images" ]; then
    echo "📁 Creating images directory..."
    mkdir -p images
fi

# Install dependencies if package.json exists
if [ -f "package.json" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start local development server
echo "🌐 Starting local development server..."
echo "   Open http://localhost:8000 in your browser"
echo "   Press Ctrl+C to stop the server"
echo ""

# Start Python HTTP server
python3 -m http.server 8000 2>/dev/null || python -m http.server 8000
