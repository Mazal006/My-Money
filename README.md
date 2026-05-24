# My Money

My Money is now a single Expo React Native codebase that runs as:

- a responsive web app through Expo Web
- a native Android app through Expo/EAS
- a native iOS app through Expo/EAS on macOS or EAS cloud builds

The app uses Supabase for cloud authentication and PostgreSQL storage when Supabase environment variables are present. Without those variables it runs in local demo mode with AsyncStorage, which is useful while developing in VS Code.

## Run Locally

1. Install Node.js LTS.
2. Install dependencies:

```bash
npm install
```

3. Start Expo:

```bash
npm run start
```

Useful targets:

```bash
npm run web
npm run android
npm run ios
```

## Supabase Backend

1. Create a free Supabase project.
2. Open the Supabase SQL editor.
3. Run `supabase/schema.sql`.
4. Copy `.env.example` to `.env`.
5. Fill in:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

Supabase Auth handles signup, signin, confirmation emails, password reset emails, and secure sessions. The database tables use Row Level Security so each user can only read and write their own accounts and expenses.

## Free Web Hosting

Vercel or Netlify can deploy directly from GitHub.

Build command:

```bash
npm run build:web
```

Publish directory:

```text
dist
```

Add the same `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` variables in the hosting provider dashboard.

## Mobile Builds

Install and log in to EAS:

```bash
npm install -g eas-cli
eas login
```

Create an Android APK on the free EAS tier:

```bash
eas build -p android --profile preview
```

Create iOS builds with EAS:

```bash
eas build -p ios --profile production
```

Apple requires an Apple Developer account for App Store distribution, but the codebase and cloud build workflow remain the same.
