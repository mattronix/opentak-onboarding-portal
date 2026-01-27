# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

# Accept build arguments for version
ARG GIT_COMMIT=dev
ARG GIT_DATE=unknown
ARG APP_VERSION=dev

WORKDIR /frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Copy VERSION file for generate-version.js
COPY VERSION ./VERSION

# Set git info as environment variables for generate-version.js
ENV GIT_COMMIT=${GIT_COMMIT}
ENV GIT_DATE=${GIT_DATE}
ENV APP_VERSION=${APP_VERSION}

# Build frontend (generate-version.js will use env vars)
RUN npm run build

# Stage 2: Python application
FROM python:3.11-slim

# Accept build arguments for version
ARG GIT_COMMIT=dev
ARG GIT_DATE=unknown

WORKDIR /app

# Copy Python requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY env.dist ./.env

# Create version.py manually using build args
RUN echo "\"\"\"Auto-generated version information\"\"\"" > app/version.py && \
    echo "" >> app/version.py && \
    echo "COMMIT = '${GIT_COMMIT}'" >> app/version.py && \
    echo "DATE = '${GIT_DATE}'" >> app/version.py && \
    echo "BUILD_TIME = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'" >> app/version.py && \
    echo "" >> app/version.py && \
    echo "def get_version():" >> app/version.py && \
    echo "    \"\"\"Get version dict\"\"\"" >> app/version.py && \
    echo "    return {" >> app/version.py && \
    echo "        'commit': COMMIT," >> app/version.py && \
    echo "        'date': DATE," >> app/version.py && \
    echo "        'build_time': BUILD_TIME" >> app/version.py && \
    echo "    }" >> app/version.py && \
    cat app/version.py

# Copy built frontend from stage 1
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

# Create necessary directories and set permissions
RUN mkdir -p /app/data_packages /app/instance && \
    useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app && \
    chmod +x /app/docker-entrypoint.sh

# Switch to non-root user
USER appuser

EXPOSE 5000

# Run with entrypoint script that handles migrations
CMD ["/app/docker-entrypoint.sh"]
