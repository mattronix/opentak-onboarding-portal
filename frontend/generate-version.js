#!/usr/bin/env node

/**
 * Generate version file with git commit hash
 * This runs during the build process to capture the current git commit
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Get git commit hash (short 12 chars)
  const gitHash = execSync('git rev-parse --short=12 HEAD')
    .toString()
    .trim();

  // Get git commit date
  const gitDate = execSync('git log -1 --format=%cd --date=short')
    .toString()
    .trim();

  // Create version object
  const version = {
    commit: gitHash,
    date: gitDate,
    buildTime: new Date().toISOString()
  };

  // Write to public folder so it's included in the build
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(publicDir, 'version.json'),
    JSON.stringify(version, null, 2)
  );

  console.log('✓ Version file generated:', version);
} catch (error) {
  console.warn('⚠ Could not generate version file:', error.message);
  // Create fallback version
  const fallback = {
    commit: 'dev',
    date: new Date().toISOString().split('T')[0],
    buildTime: new Date().toISOString()
  };

  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(publicDir, 'version.json'),
    JSON.stringify(fallback, null, 2)
  );
}
