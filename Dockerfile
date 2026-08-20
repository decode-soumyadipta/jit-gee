FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy application files
COPY . .

# Set default port
ENV PORT=7860
EXPOSE 7860

# Run with gunicorn
CMD ["sh", "-c", "gunicorn --chdir backend server:app --bind 0.0.0.0:${PORT:-7860} --workers 2 --timeout 120"]
