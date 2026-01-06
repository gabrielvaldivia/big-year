# Big Year

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

Open `http://localhost:3000`, sign in with Google, and you'll see your all-day events plotted across the full-year view. Use the arrows or Today button to navigate the year.

## Production Setup (Vercel)

When deploying to Vercel, you need to configure both your Vercel environment variables and your Google OAuth credentials:

### 1. Set Vercel Environment Variables

In your Vercel project dashboard, go to **Settings** → **Environment Variables** and ensure you have:

- `NEXTAUTH_URL` = `https://bigyear.app` (or your custom domain)
- `NEXTAUTH_SECRET` = a strong random string (generate with `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID` = your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` = your Google OAuth client secret
- `DATABASE_URL` = your PostgreSQL connection string (see `VERCEL_SETUP.md`)

**Important**: Make sure `NEXTAUTH_URL` matches your actual Vercel deployment URL exactly (including `https://`).

### 2. Configure Google OAuth for Production

In your [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Go to your OAuth 2.0 Client ID
2. Under **Authorized redirect URIs**, add:
   - `https://bigyear.app/api/auth/callback/google` (or your custom domain)
3. Save the changes

**Note**: You can have multiple redirect URIs - one for local development (`http://localhost:3000/api/auth/callback/google`) and one for production.

### 3. Redeploy

After updating the environment variables and Google OAuth settings, trigger a new deployment in Vercel (or push a commit) to apply the changes.

## Fixing "Esta aplicación está bloqueada" / "This application is blocked" Error

If users are seeing a Google security warning that says "Esta aplicación está bloqueada" (This application is blocked), this means Google is blocking access to sensitive scopes. Here's how to fix it:

### Critical: Publish Your App

**The most common cause is that your app is still in "Testing" mode.** When an app is in testing mode, only users added to the test users list can access it. All other users will see the blocked error.

1. Go to [Google Cloud Console OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Check the **Publishing status** section at the top
3. If it says "Testing", click **Publish App**
4. Confirm the publishing
5. **Important**: After publishing, wait 5-10 minutes for changes to propagate

### Verify OAuth Consent Screen Configuration

Make sure your OAuth consent screen is fully configured:

1. Go to [Google Cloud Console OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Verify all required fields are filled:
   - **App name**: Big Year (or your preferred name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
   - **Application home page**: `https://bigyear.app`
   - **Privacy Policy link**: `https://bigyear.app/privacy`
   - **Terms of Service link**: `https://bigyear.app/terms`
3. Under **Scopes**, ensure these are all listed:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events` ⚠️ **This is a sensitive scope**
4. **Check for region restrictions**: Scroll down to see if there are any country/region restrictions enabled. If you want global access, make sure no countries are blocked.
5. Save all changes

### Why This Happens

The app requests `calendar.events` scope, which allows write access to calendars. Google considers this a **sensitive scope** and requires:
- The app to be published (not in testing mode)
- Proper OAuth consent screen configuration
- Eventually, full verification for complete removal of warnings

### After Publishing

- The app will be available to all Google users worldwide
- Users may still see a brief "unverified app" warning, but they can proceed
- For complete removal of warnings, submit for verification (see below)

### International Access Notes

- **Google OAuth doesn't restrict by country/region by default**, but unverified apps with sensitive scopes may show different warnings in different regions
- If users in specific countries are blocked, check the OAuth consent screen for any country restrictions
- The error message language (e.g., Spanish "Esta aplicación está bloqueada") reflects the user's Google account language preference, not a regional restriction
- Publishing the app and completing verification ensures access for users worldwide

## Removing "Unverified App" Warnings

To remove the Google "unverified app" warning screens, you need to configure your OAuth consent screen and optionally submit your app for verification:

### Step 1: Configure OAuth Consent Screen

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials/consent)
2. Select your OAuth 2.0 Client ID project
3. Fill out the **OAuth consent screen**:
   - **User Type**: Choose "External" (unless you have a Google Workspace)
   - **App name**: Big Year (or your preferred name)
   - **User support email**: gabe@valdivia.works (your email)
   - **Developer contact information**: gabe@valdivia.works
   - **App domain** (optional): bigyear.app
   - **Authorized domains**: Add `bigyear.app` (or your custom domain)
   - **Application home page**: `https://bigyear.app`
   - **Privacy Policy link**: `https://bigyear.app/privacy`
   - **Terms of Service link**: `https://bigyear.app/terms`
4. Under **Scopes**, add:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
5. Save and continue

### Step 2: Publish Your App (Recommended)

After configuring the consent screen:

1. Go to the **Publishing status** section
2. Click **Publish App**
3. Confirm the publishing

**Note**: Publishing makes your app available to all Google users. The "unverified app" warnings will be significantly reduced, though some users may still see a brief warning if you haven't completed full verification.

### Step 3: Full Verification (Optional)

For complete removal of warnings and a verified badge:

1. Go to [Google Cloud Console OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Click **Submit for verification**
3. Complete the verification form with:
   - Detailed explanation of why you need each scope
   - Video demonstration of your app
   - Privacy policy and terms of service (already created above)
4. Wait for Google's review (can take several weeks)

**Important**: The privacy policy and terms pages are already created at `/privacy` and `/terms`. Make sure your app is deployed so these URLs are accessible before submitting for verification.

## Fixing Google Cloud Console Security Alerts

If you see security alerts in Google Cloud Console's "Project Checkup", here's how to fix them:

### 1. Use Secure Flows (PKCE)

NextAuth automatically uses PKCE for secure OAuth flows. To ensure it's working correctly:

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID ("Big Year Calendar")
3. Verify **Application type** is set to "Web application" (not "Desktop app" or "Other")
4. Ensure **Authorized redirect URIs** are properly configured with HTTPS URLs
5. Save any changes

**Note**: If the alert persists, it may take 24-48 hours for Google's systems to recognize the secure flow configuration.

### 2. Incremental Authorization

To enable incremental authorization support:

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID
3. Look for **Advanced settings** or scroll down to find configuration options
4. Some OAuth clients automatically support incremental authorization when configured as "Web application" type
5. If there's an explicit option to enable it, turn it on

**Alternative**: If incremental authorization isn't available or applicable (since this app needs all scopes from the start), you can:
- Click "Learn how to fix it" in the Project Checkup alert for specific guidance
- The alert may be informational rather than critical if your app legitimately needs all scopes upfront

### 3. Cross-Account Protection

To enable Cross-Account Protection:

1. Go to [APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Scroll down to find **Advanced settings** or look for **Security** section
3. Enable **Cross-Account Protection**
4. This feature helps prevent unauthorized access when users have multiple Google accounts
5. Save the changes

**Note**: Cross-Account Protection is a security feature that Google recommends for production apps.

### 4. Verify Configuration

After making these changes:

1. Wait 24-48 hours for changes to propagate through Google's systems
2. Go back to [Project Checkup](https://console.cloud.google.com/apis/security/checkup)
3. Refresh the page to see updated status
4. Some alerts may require additional configuration or may be informational

**Important**: The "Send token securely" and "WebViews usage" alerts showing green checkmarks indicate those security measures are already correctly configured.

## Notes

- Only all-day events are fetched: events with `start.date` (not `start.dateTime`) are included.
- Access tokens are automatically refreshed using the Google refresh token.
- The calendar auto-fills the entire viewport (full width and height).
