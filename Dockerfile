# Stage 1: Build the React frontend
FROM node:18-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve using FastAPI backend
FROM python:3.10-slim

# Prevent Python from buffering stdout/stderr
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy the rest of the backend files and directories
COPY api.py .
COPY .env .
COPY modules/ ./modules/
COPY data/ ./data/
COPY components/ ./components/

# Hugging Face Spaces expects apps to run on port 7860
EXPOSE 7860

# Run FastAPI app with uvicorn
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "7860"]
