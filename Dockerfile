FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /srv/medidenta
COPY hosting/requirements.txt /tmp/medidenta-requirements.txt
RUN pip install --no-cache-dir -r /tmp/medidenta-requirements.txt \
    && groupadd --system medidenta \
    && useradd --system --gid medidenta --home-dir /srv/medidenta medidenta
COPY hosting /srv/medidenta/hosting
COPY medidenta-preview /srv/medidenta/medidenta-preview
USER medidenta
EXPOSE 10000
CMD ["sh", "-c", "exec uvicorn hosting.main:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers --forwarded-allow-ips='*'"]
