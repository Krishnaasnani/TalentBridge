# TalentBridge web app

The TalentBridge client is a React and Vite application for candidates, employers, and administrators.

## Commands

```text
npm run dev
npm run lint
npm run build
```

## Configuration

The client accepts one optional public build-time setting:

```text
VITE_API_URL=http://localhost:5000/api
```

For local development, leave it unset to use the local API default. For a separately hosted API, copy `.env.example` to `.env` and supply the public API origin including `/api`.

Vite embeds `VITE_*` values in browser assets. Never place secrets in the client environment file.
