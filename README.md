# Yearly Calendar

Full-screen yearly calendar that shows only all-day events from your Google Calendar. Built with Next.js (App Router), Tailwind CSS, and shadcn-style UI components.

## Quickstart

1. Install dependencies:

```bash
npm install
```

2. Create `.env` in the project root with:

```
DATABASE_URL=your-postgresql-database-url
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-strong-random-string

GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

For local development, you can use a local PostgreSQL database or a free hosted option like [Neon](https://neon.tech) or [Supabase](https://supabase.com).

3. Configure your Google OAuth app:

   - App type: Web application
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Scopes: `openid email profile https://www.googleapis.com/auth/calendar.readonly`

4. Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`, sign in with Google, and you’ll see your all-day events plotted across the full-year view. Use the arrows or Today button to navigate the year.

## Notes

- Only all-day events are fetched: events with `start.date` (not `start.dateTime`) are included.
- Access tokens are automatically refreshed using the Google refresh token.
- The calendar auto-fills the entire viewport (full width and height).
