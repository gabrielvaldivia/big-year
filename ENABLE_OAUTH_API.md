# How to Enable OAuth API (If Needed)

## The Issue

When searching for "Google OAuth2 API" in the API Library, you might not find it. This is normal - the API might:
1. Already be enabled (check "Enabled APIs & services" first)
2. Be named differently
3. Not need to be explicitly enabled (it's part of core Google Cloud)

## Quick Check: Is It Already Enabled?

**Easiest way to check:**

1. Go to **"APIs & Services"** → **"Enabled APIs & services"** (in the left sidebar)
2. Look through the list - if you see anything with "OAuth" or "Identity" in the name, it's likely already enabled
3. **If you can create OAuth 2.0 Client IDs** on the Credentials page, the API is already working

## If You Need to Enable It

### Method 1: Via API Library (Try Different Search Terms)

1. Go to **"APIs & Services"** → **"API Library"**
2. Try searching for (one at a time):
   - Just **"oauth"** (lowercase, no "2", no "API")
   - **"Identity"**
   - **"Google+ API"** (older name)
   - **"People API"**

3. If you find it, click on it and click **"ENABLE"**

### Method 2: Via gcloud CLI (Most Reliable)

```bash
# First, check what's enabled
gcloud services list --enabled | grep -i oauth

# If nothing shows up, enable it
gcloud services enable oauth2.googleapis.com

# Also enable IAM API (often needed)
gcloud services enable iam.googleapis.com
```

### Method 3: Direct API Enable URL

Try this direct URL (replace `YOUR_PROJECT_ID`):
```
https://console.cloud.google.com/apis/library/oauth2.googleapis.com?project=YOUR_PROJECT_ID
```

## Important Note

**You might not need to enable it at all!**

The OAuth consent screen functionality is part of Google Cloud's core services. If you can:
- Access the Credentials page
- See/create OAuth 2.0 Client IDs
- See the "OAuth consent screen" link (even if it redirects)

Then the OAuth functionality is already available. The issue is likely permissions or a UI bug, not a missing API.

## What APIs Are Actually Needed?

For OAuth consent screen, these APIs are typically needed:
- **OAuth2 API** (`oauth2.googleapis.com`) - but this might be automatically enabled
- **IAM API** (`iam.googleapis.com`) - for permissions
- **Identity Platform API** (`identity.googleapis.com`) - sometimes needed

But again, if you can create OAuth clients, these are likely already working.

## Next Steps

If the API is already enabled (or you've enabled it) but you still can't access the OAuth consent screen:

1. The issue is likely **permissions** or a **UI bug**
2. See `ALTERNATIVE_SOLUTIONS.md` for:
   - Granting `oauthconfig.editor` role
   - Using gcloud CLI
   - Contacting Google Support



