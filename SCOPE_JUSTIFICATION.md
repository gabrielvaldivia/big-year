# Scope Justification for Google OAuth Approval

## Scope Justification Text (1000 characters max)

Here's a suggested justification you can use or adapt:

```
Big Year Calendar is a full-screen yearly calendar application that helps users visualize and manage their all-day events from Google Calendar. 

We need calendar.readonly to:
- Display all-day events from users' Google Calendars in a year-view format
- Allow users to see their calendar events across multiple calendars they have access to
- Show event information including titles, dates, and which calendar each event belongs to

We need calendar.events to:
- Allow users to create new all-day events directly from the calendar interface
- Enable users to edit existing all-day events (update titles, dates)
- Let users delete events they no longer need
- Provide a seamless calendar management experience without leaving the app

More limited scopes aren't sufficient because:
- calendar.readonly alone doesn't allow users to create or modify events, which is a core feature
- Users need write access to manage their calendar events within the application
- The app is designed as a complete calendar management tool, not just a read-only viewer

The app only requests access to all-day events (events with start.date, not start.dateTime), respecting user privacy by not accessing detailed time-based calendar information.
```

**Character count:** ~850 characters (well under the 1000 limit)

## Demo Video Requirements

You need to create a YouTube video that demonstrates:

1. **How you use calendar.readonly:**
   - Show the app displaying events from Google Calendar
   - Demonstrate viewing events across the year
   - Show events from different calendars

2. **How you use calendar.events:**
   - Show creating a new all-day event
   - Show editing an existing event
   - Show deleting an event
   - Verify the changes appear in Google Calendar

3. **OAuth flow:**
   - Show the sign-in process
   - Show the consent screen
   - Show granting permissions

4. **All OAuth clients:**
   - If you have multiple OAuth clients (e.g., localhost and production), show both in the video

## Video Tips

- Keep it under 5 minutes (shorter is better)
- Show the actual app in action, not just screenshots
- Narrate what you're doing or add text overlays
- Make sure the video is set to "Public" or "Unlisted" on YouTube
- Test the video link works before submitting

## What Happens After Submission

1. Google will review your justification and video
2. Review can take **several weeks** (often 2-4 weeks, sometimes longer)
3. Once approved, the 100-user cap will be removed
4. New users will be able to sign in without being blocked

## Alternative: While Waiting for Approval

While waiting for approval:
- Existing users (within the 100) can still use the app
- New users will see the cap message
- You can explain to users that approval is pending

## Quick Start

1. **Write the justification** (use the template above)
2. **Create a screen recording** showing:
   - Sign in with Google
   - Viewing calendar events
   - Creating an event
   - Editing an event
   - Deleting an event
3. **Upload to YouTube** (set to Public or Unlisted)
4. **Paste the justification and video link** in the Data Access page
5. **Click "Save"**
6. **Go to Verification Center** to submit for review



