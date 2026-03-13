#!/usr/bin/env bash
# exit on error
set -o errexit

npm install

# Install Chrome specifically for Puppeteer to use on Render
echo "Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome
