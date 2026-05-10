# NetShield
NetShield: DDoS & Intrusion Detection System Real-time Network Security Orchestrated via Polyglot Microservices NetShield is a 3-tier security platform designed to detect and analyze network threats. By combining high-performance AI inference with a secure, scalable backend, NetShield provides a comprehensive "holographic" view of network health.

## Local Running Instructions

Follow these steps to run NetShield locally:

### 1. Run the AI Service (Python/FastAPI)
- Navigate to `ml_service/`
- Install dependencies: `pip install -r requirements.txt`
- Start the service: `uvicorn main:app --port 8000`

### 2. Run the Backend (Spring Boot)
- Navigate to `demo/`
- Run the application: `./mvnw spring-boot:run`
- The backend will run on port `9091` and use a local H2 database (`netshield.mv.db`) by default.

### 3. Run the Frontend (React)
- Navigate to `dashboard-ui/`
- Install dependencies: `npm install`
- Start the app: `npm start`
- The dashboard will be available at `http://localhost:3000`.

## Docker Run
Alternatively, you can run all services using Docker Compose:
```bash
docker-compose up --build
```
The services will be available at:
- Frontend: `http://localhost:8080`
- Backend: `http://localhost:9091`
- AI Service: `http://localhost:8000`
