# My Money

My Money is a personal finance tracker prototype for web and mobile-style use.

## Open in VS Code

1. Open this folder in VS Code: `C:\Users\User\Desktop\My Money`
2. Open `index.html`
3. Right-click the file and choose `Open with Live Server`, or double-click `index.html` in File Explorer.

The current version stores data in the browser with `localStorage`, so it works without a backend.

## Current Features

- Create an account and sign in
- Simulated verification code for registration
- Simulated password reset with a verification code
- Create, edit, and delete financial accounts
- Change account currency
- Add or change an account icon
- Track expenses against a selected account
- Categorize spending
- View account balances, monthly spend, top category, and AI-style analytics
- Mobile responsive layout and PWA manifest

## Next Build Steps

- Install Node.js, then move this into a React or React Native codebase
- Add a real backend with a database
- Replace simulated verification with email or SMS verification
- Replace local password storage with secure authentication
- Connect a real AI service for deeper spending analysis and budgeting suggestions
- Wrap the web app as a mobile app with Capacitor, or rebuild the UI in React Native
