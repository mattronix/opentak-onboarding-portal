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

// Read VERSION file (check both Docker location and local dev location)
let appVersion = 'dev';
try {
  // Docker build: VERSION is copied to same directory
  let versionFile = path.join(__dirname, 'VERSION');
  if (!fs.existsSync(versionFile)) {
    // Local dev: VERSION is in parent (root) directory
    versionFile = path.join(__dirname, '..', 'VERSION');
  }
  if (fs.existsSync(versionFile)) {
    appVersion = fs.readFileSync(versionFile, 'utf8').trim();
  }
} catch (error) {
  console.warn('⚠ Could not read VERSION file:', error.message);
}

// Check for APP_VERSION env var (Docker build)
if (process.env.APP_VERSION) {
  appVersion = process.env.APP_VERSION;
}

// Check if running in Docker with build args
if (process.env.GIT_COMMIT && process.env.GIT_DATE) {
  console.log('Using git info from environment variables (Docker build)');
  version = {
    version: appVersion,
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
      version: appVersion,
      commit: gitHash,
      date: gitDate,
      buildTime: new Date().toISOString()
    };

    console.log('✓ Version file generated from git:', version);
  } catch (error) {
    console.warn('⚠ Could not get git info:', error.message);
    // Create fallback version
    version = {
      version: appVersion,
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
