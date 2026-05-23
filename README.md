# My Money

My Money is a personal finance tracker prototype for web and mobile-style use.

## Open in VS Code

1. Open this folder in VS Code: `C:\Users\User\Desktop\My Money`
2. Open `index.html`
3. Right-click the file and choose `Open with Live Server`, or double-click `index.html` in File Explorer.

The current version stores finance data in the browser with `localStorage`, so it works without a backend. Authentication is still a prototype: verification codes are backend-ready, but in local demo mode they are written to the browser console instead of being emailed.

## Current Features

- Create an account and sign in with a verification code step
- Verification code flow for registration, sign in, and password reset
- Hashed local prototype passwords with automatic migration from older local test accounts
- Create, edit, and delete financial accounts
- Change account currency
- Add or change an account icon
- Track expenses against a selected account
- Categorize spending
- View account balances, monthly spend, liabilities, and AI-style analytics
- Mobile responsive layout and PWA manifest

## Next Build Steps

- Install Node.js, then move this into a React or React Native codebase
- Add a real backend with a database and `/auth/challenges` email delivery endpoints
- Store sessions in secure, HTTP-only cookies for web and short-lived tokens for mobile
- Move password hashing, rate limiting, lockouts, and audit logs to the backend
- Connect a real AI service for deeper spending analysis and budgeting suggestions
- Wrap the web app as a mobile app with Capacitor, or rebuild the UI in React Native
