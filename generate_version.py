#!/usr/bin/env python3
"""
Generate version.py file with git commit hash
This runs during Docker build or deployment to capture the current git commit
"""

import subprocess
import json
from datetime import datetime
from pathlib import Path

def get_git_info():
    """Get git commit info"""
    try:
        # Get git commit hash (short 12 chars)
        git_hash = subprocess.check_output(
            ['git', 'rev-parse', '--short=12', 'HEAD'],
            stderr=subprocess.DEVNULL
        ).decode('utf-8').strip()

        # Get git commit date
        git_date = subprocess.check_output(
            ['git', 'log', '-1', '--format=%cd', '--date=short'],
            stderr=subprocess.DEVNULL
        ).decode('utf-8').strip()

        return {
            'commit': git_hash,
            'date': git_date,
            'build_time': datetime.utcnow().isoformat() + 'Z'
        }
    except (subprocess.CalledProcessError, FileNotFoundError):
        # Fallback if git is not available or not a git repo
        return {
            'commit': 'dev',
            'date': datetime.utcnow().strftime('%Y-%m-%d'),
            'build_time': datetime.utcnow().isoformat() + 'Z'
        }

def main():
    version_info = get_git_info()

    # Write to app/version.py
    version_file = Path(__file__).parent / 'app' / 'version.py'

    with open(version_file, 'w') as f:
        f.write('"""Auto-generated version information"""\n\n')
        f.write(f"COMMIT = '{version_info['commit']}'\n")
        f.write(f"DATE = '{version_info['date']}'\n")
        f.write(f"BUILD_TIME = '{version_info['build_time']}'\n")
        f.write('\n')
        f.write('def get_version():\n')
        f.write('    """Get version dict"""\n')
        f.write('    return {\n')
        f.write("        'commit': COMMIT,\n")
        f.write("        'date': DATE,\n")
        f.write("        'build_time': BUILD_TIME\n")
        f.write('    }\n')

    print(f'✓ Backend version file generated: {version_info}')

if __name__ == '__main__':
    main()
