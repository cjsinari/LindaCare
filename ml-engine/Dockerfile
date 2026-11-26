FROM python:3.14-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY requirements-prod.txt .
RUN pip install -r requirements-prod.txt

# app.py resolves models/ relative to its own parent folder, so the layout under
# /app mirrors the repo: /app/src/app.py and /app/models/*.
COPY src ./src
COPY models/isolation_forest_synthetic.pkl models/scaler_synthetic.pkl models/model_metadata_synthetic.json ./models/

RUN useradd --create-home app && chown -R app /app
USER app
EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=3).status==200 else 1)"

# Flask's own server (debug=True in app.py) is for development. Gunicorn does not
# execute the __main__ block, so debug mode never runs here.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "30", "src.app:app"]
