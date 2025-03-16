#!/bin/bash

# Exit on any error
set -e

# VPS Configuration
VPS_USER="mallky"
VPS_HOST="89.111.154.130"
REMOTE_DIR="/var/bots/todo-telegram"

echo "🚀 Starting deployment process..."

# Check if SSH key exists and connection is possible
ssh -q -o BatchMode=yes -o ConnectTimeout=5 "$VPS_USER@$VPS_HOST" exit 2>/dev/null || {
    echo "❌ SSH connection failed. Please ensure:"
    echo "1. You have added your SSH key to the VPS"
    echo "2. The VPS_USER and VPS_HOST variables are correct"
    exit 1
}

# Create remote directory and set permissions
ssh "$VPS_USER@$VPS_HOST" "sudo -S mkdir -p $REMOTE_DIR && sudo -S chown -R $VPS_USER:$VPS_USER $REMOTE_DIR && sudo -S chmod -R 755 $REMOTE_DIR"

# Copy project files to VPS
echo "📦 Copying project files to VPS..."
rsync -avz --include='.env' ./ "$VPS_USER@$VPS_HOST:$REMOTE_DIR/"

# Set proper ownership and permissions for .env file
ssh "$VPS_USER@$VPS_HOST" "sudo -S chown $VPS_USER:$VPS_USER $REMOTE_DIR/.env && sudo -S chmod 600 $REMOTE_DIR/.env"

# Install dependencies on VPS
echo "📦 Installing dependencies on VPS..."
ssh "$VPS_USER@$VPS_HOST" "cd $REMOTE_DIR && \
    # Check if required commands are available
    command -v mysql >/dev/null 2>&1 || { echo '❌ MySQL is not installed on VPS. Please install MySQL first.'; exit 1; } && \
    command -v node >/dev/null 2>&1 || { echo '❌ Node.js is not installed on VPS. Please install Node.js first.'; exit 1; } && \
    command -v npm >/dev/null 2>&1 || { echo '❌ npm is not installed on VPS. Please install npm first.'; exit 1; } && \
    
    # Install project dependencies
    echo '📦 Installing project dependencies...' && \
    npm install && \
    
    # Check if .env file exists and has correct permissions
    if [ ! -f '.env' ]; then
        echo '❌ .env file not found. Please check if it was copied correctly.'
        exit 1
    fi && \
    
    # Verify .env file contains required variables
    if ! grep -q 'BOT_TOKEN' '.env'; then
        echo '❌ BOT_TOKEN not found in .env file'
        exit 1
    fi && \
    
    # Stop any existing process
    pkill -f 'node src/index.js' || true && \
    
    # Start the application using node directly with nohup
    echo '🚀 Starting the application...' && \
    nohup node src/index.js > app.log 2>&1 &"

echo "✅ Deployment completed successfully!"
echo "ℹ️ Your bot is now running on the VPS"
echo "ℹ️ To view logs, run: ssh $VPS_USER@$VPS_HOST 'tail -f $REMOTE_DIR/app.log'"