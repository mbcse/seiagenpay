#!/bin/bash

# AgenPay Development Startup Script
echo "🚀 Starting AgenPay Development Environment..."

# Check if backend is running
if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "⚠️  Backend not detected on port 3001"
    echo "Please start the backend first:"
    echo "  cd ../agenpay-backend && npm run dev"
    echo ""
    read -p "Press Enter when backend is running..."
fi

echo "✅ Backend detected!"
echo "🌐 Starting frontend on http://localhost:3000"
echo ""

# Start the frontend
npm run dev 