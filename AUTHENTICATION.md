# Authentication

Authentication is now handled by Supabase Auth when the Expo environment variables are configured.

## Required Environment Variables

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

## Current Flow

- Sign up uses `supabase.auth.signUp`.
- Sign in uses `supabase.auth.signInWithPassword`.
- Password reset uses `supabase.auth.resetPasswordForEmail`.
- Sessions are managed by Supabase on web, iOS, and Android.
- Finance data is stored in PostgreSQL tables protected by Row Level Security.

## Local Demo Mode

If Supabase variables are missing, the app runs with AsyncStorage and a local demo login. This is only for offline development and should not be used as production authentication.

## Database

Run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor before using the cloud backend.
