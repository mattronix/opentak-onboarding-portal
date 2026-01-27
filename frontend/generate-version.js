#!/usr/bin/env node

/**
 * Generate version file with git commit hash
 * This runs during the build process to capture the current git commit
 *
 * Supports two modes:
 * 1. Local dev: Uses git commands to get version info
 * 2. Docker build: Uses GIT_COMMIT and GIT_DATE environment variables
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let version;

// Check if running in Docker with build args
if (process.env.GIT_COMMIT && process.env.GIT_DATE) {
  console.log('Using git info from environment variables (Docker build)');
  version = {
    commit: process.env.GIT_COMMIT,
    date: process.env.GIT_DATE,
    buildTime: new Date().toISOString()
  };
} else {
  // Try to get git info from git commands (local dev)
  try {
    // Get git commit hash (short 12 chars)
    const gitHash = execSync('git rev-parse --short=12 HEAD')
      .toString()
      .trim();

    // Get git commit date
    const gitDate = execSync('git log -1 --format=%cd --date=short')
      .toString()
      .trim();

    version = {
      commit: gitHash,
      date: gitDate,
      buildTime: new Date().toISOString()
    };

    console.log('✓ Version file generated from git:', version);
  } catch (error) {
    console.warn('⚠ Could not get git info:', error.message);
    // Create fallback version
    version = {
      commit: 'dev',
      date: new Date().toISOString().split('T')[0],
      buildTime: new Date().toISOString()
    };
  }
}

// Write to public folder so it's included in the build
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(
  path.join(publicDir, 'version.json'),
  JSON.stringify(version, null, 2)
);

console.log('✓ Version file written:', version);
