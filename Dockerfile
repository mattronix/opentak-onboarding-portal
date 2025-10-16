# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Install git for version generation
RUN apk add --no-cache git

# Copy .git folder for version generation
COPY .git/ ../.git/

# Copy frontend package files
COPY frontend/package*.json ./
COPY frontend/generate-version.js ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend (includes version generation)
RUN npm run build

# Stage 2: Python application
FROM python:3.11-slim

WORKDIR /app

# Install git for version generation
RUN apt-get update && \
    apt-get install -y git && \
    rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY .env.example ./.env

# Copy and run version generator for backend
COPY generate_version.py ./
RUN python generate_version.py || echo "Warning: Could not generate backend version"

# Copy built frontend from stage 1
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Create necessary directories and set permissions
RUN mkdir -p /app/data_packages /app/instance && \
    useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 5000

# Run with gunicorn - app:app refers to app/__init__.py:app
CMD ["gunicorn", "-w", "1", "-t", "50", "app:app", "-b", "0.0.0.0:5000"]
