# TalentBridge Release Readiness Checklist

## Required configuration

Create local `.env` files from `Server/.env.example`, `AIService/.env.example`,
and `Client/.env.example` when deploying the frontend against a separately
hosted API.

- Configure MongoDB, JWT, and Cloudinary values in `Server/.env`.
- Configure `GEMINI_API_KEY` in `AIService/.env`.
- Generate a high-entropy `AI_SERVICE_API_KEY` and use the exact same value in both files.
- Set `FRONTEND_URL` to the deployed browser origin and `AI_SERVICE_URL` to the private AI-service URL.
- Set `VITE_API_URL` to the deployed public API URL including `/api`, then rebuild the client.
- Do not commit either `.env` file.

## Build and test gates

Run before release:

```text
cd Server && npm test
cd Client && npm run lint && npm run build
cd AIService && python -m unittest -v test_main.py
```

## Startup commands

```text
cd Server && npm start
cd AIService && uvicorn main:app --host 0.0.0.0 --port 8000
```

The generated frontend assets are in `Client/dist` after `npm run build`.

## Health checks

- Server: `GET /health` returns `200` only when MongoDB is connected; otherwise it returns `503`.
- AI service: `GET /health` returns `200` when the service process is running.
- AI analysis routes require the internal `X-AI-Service-Key` header and should not be exposed publicly without network restrictions.

## Batch 11 verification — 2026-11-11

### Automated checks

- `cd Server && npm test`: **PASS** — 98 tests passed, 0 failed.
- The automated suite includes Helmet response-header coverage and protected-route authorization coverage.

### Manual local checks

- The frontend's configured local API address is `http://localhost:5000/api`; the local frontend origin completed a CORS preflight to that address with `204` and `Access-Control-Allow-Origin: http://localhost:5173`.
- The process currently listening on port 5000 returned `200` from `/health` and `401` for an unauthenticated `GET /api/user/profile`.
- **BLOCKED:** That existing port-5000 process did not return the expected Helmet headers and could not be attributed safely to the current Server source. Do not treat it as a release-ready current-source verification. Stop the known stale process from its owning terminal, start `Server/server.js` on port 5000, and repeat the health-header check before the next integration-testing batch.

### Remaining manual QA

- Live Cloudinary, Gemini, and end-to-end AI workflow checks require an explicitly isolated non-production environment.
- Browser and responsive-layout QA remain outstanding.

## Frontend API address

The client defaults to `http://localhost:5000/api` only for local development.
Production deployments with a separately hosted backend must set `VITE_API_URL`
at build time to the deployed API URL including `/api`.
