FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends     build-essential     libgl1     libglib2.0-0     && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt     && find /usr/local/lib/python3.12/site-packages -type d -name 'nvidia*' -exec rm -rf {} + 2>/dev/null || true     && find /usr/local/lib/python3.12/site-packages -type d -name 'nvidia' -exec rm -rf {} + 2>/dev/null || true     && find /usr/local/lib/python3.12/site-packages -type f -name 'libcudnn*' -delete 2>/dev/null || true     && find /usr/local/lib/python3.12/site-packages -type f -name 'libcublas*' -delete 2>/dev/null || true     && find /usr/local/lib/python3.12/site-packages -type f -name 'libcufft*' -delete 2>/dev/null || true     && find /usr/local/lib/python3.12/site-packages -type f -name 'libcurand*' -delete 2>/dev/null || true     && find /usr/local/lib/python3.12/site-packages -type f -name 'libcusolver*' -delete 2>/dev/null || true     && find /usr/local/lib/python3.12/site-packages -type f -name 'libcusparse*' -delete 2>/dev/null || true     && find /usr/local/lib/python3.12/site-packages -type f -name 'libnccl*' -delete 2>/dev/null || true     && find /usr/local/lib/python3.12/site-packages -type f -name 'libtorch_cuda*' -delete 2>/dev/null || true     && find /usr/local/lib/python3.12/site-packages -type f -name 'libtorch_cpu*' -delete 2>/dev/null || true     && find /usr/local/lib/python3.12/site-packages -type f -name '*.so' -size +50M -exec rm -f {} + 2>/dev/null || true     && find /usr/local/lib/python3.12 -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true     && find /usr/local/lib/python3.12 -type f -name '*.pyc' -delete 2>/dev/null || true     && rm -rf /root/.cache/pip

COPY . .

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
