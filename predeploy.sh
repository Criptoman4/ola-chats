#!/bin/bash

# Build script for Firebase deployment

echo "🚀 Starting pre-deployment build process..."

# 1. Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing Node dependencies..."
  npm install
fi

# 2. Run ESLint (if you have it set up)
if [ -f ".eslintrc.js" ]; then
  echo "🔍 Running ESLint..."
  npx eslint .
fi

# 3. Minify CSS (using clean-css-cli)
if [ -f "public/styles/main.css" ]; then
  echo "🎨 Minifying CSS..."
  npx clean-css-cli -O2 -o public/styles/main.min.css public/styles/main.css
fi

# 4. Bundle and minify JS (using esbuild)
echo "⚡ Bundling and minifying JavaScript..."
npx esbuild public/app.js --bundle --minify --outfile=public/app.bundle.js

# 5. Update index.html to use minified files
echo "📝 Updating HTML files..."
sed -i.bak 's/main.css/main.min.css/g' public/index.html
sed -i.bak 's/app.js/app.bundle.js/g' public/index.html

# 6. Remove backup files
rm -f public/index.html.bak

echo "✅ Build completed successfully!"