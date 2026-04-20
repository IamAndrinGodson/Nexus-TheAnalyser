FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download MaxMind GeoIP2 database (requires MAXMIND_KEY build arg)
ARG MAXMIND_KEY=""
RUN mkdir -p data && \
    if [ -n "$MAXMIND_KEY" ]; then \
        wget -qO- "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_KEY}&suffix=tar.gz" | \
        tar -xz --strip-components=1 -C data/ || true; \
    fi

COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
