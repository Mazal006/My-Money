# Authentication Contract

This app is currently a frontend prototype. Real email verification must be handled by a backend or an auth provider, not by browser-only JavaScript.

## Required Backend Endpoints

### `POST /auth/challenges`

Sends an email verification code.

Request:

```json
{
  "purpose": "signup",
  "email": "user@example.com"
}
```

Allowed `purpose` values:

- `signup`
- `signin`
- `reset`

Response:

```json
{
  "challengeId": "server-generated-id"
}
```

### `POST /auth/challenges/verify`

Verifies the emailed code.

Request:

```json
{
  "purpose": "signin",
  "email": "user@example.com",
  "code": "123456",
  "challengeId": "server-generated-id"
}
```

Response:

```json
{
  "ok": true
}
```

## Security Requirements

- Send codes by email from the backend only.
- Expire codes after 10 minutes or less.
- Limit attempts per challenge and per IP address.
- Store password hashes on the backend with Argon2id or bcrypt.
- Never store plaintext passwords.
- Use secure HTTP-only cookies for web sessions.
- Use short-lived access tokens and refresh tokens for mobile apps.
- Return generic messages for sign-in and reset failures to avoid account enumeration.
