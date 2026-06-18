Workcosmo Auth Server
=====================

This small Express service verifies an employee code + password against Firestore and issues a Firebase custom token.

Quick start (local):

1. Install dependencies

```bash
cd api/auth-server
npm install
```

2. Provide credentials

Either set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON, or export `FIREBASE_SERVICE_ACCOUNT` with the JSON content.

3. Run

```bash
npm start
```

Endpoint: `POST /customToken`
Payload: `{ "code": "EMP001", "password": "secret", "companyId": "acme" }`
Response: `{ "token": "<firebase_custom_token>" }`

Deploy: This file exports an Express `app` so it can be deployed as a Firebase Cloud Function or to any Node host.
