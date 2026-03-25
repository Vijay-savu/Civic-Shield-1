# CivicShield Microservices Mode

This project now supports a real multi-process microservices runtime.

## Services
- auth-service: handles /api/v1/auth, /api/v1/secure
- document-service: handles /api/v1/documents, /api/v1/check-tamper/:id
- verification-service: handles /api/v1/verification, /api/v1/applications
- monitoring-service: handles /api/v1/alerts, /api/v1/admin, /api/v1/audit, /api/v1/demo
- api-gateway: single entrypoint on port 5000 that routes to all services

## Local Run (without Docker)
From `backend` directory:

```powershell
npm run start:micro:all
```

Service ports (defaults):
- Gateway: 5000
- Auth: 5001
- Document: 5002
- Verification: 5003
- Monitoring: 5004

## Docker Run
From repository root:

```powershell
docker compose -f docker-compose.microservices.yml up --build
```

## Notes
- JWT secret must be identical across services.
- All services connect to the same MongoDB for now (hackathon-friendly split).
- Existing monolith mode still works via `npm run dev` in backend.
