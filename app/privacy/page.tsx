export default function PrivacyPage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <div className="prose prose-slate">
        <p className="text-sm text-gray-600 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Information We Collect</h2>
          <p>
            Big Year accesses your Google Calendar data to display all-day events on a yearly calendar view. 
            We only access calendar events that you explicitly grant permission for.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">How We Use Your Information</h2>
          <p>
            Your calendar data is used solely to display events in the calendar interface. 
            We do not store, share, or sell your calendar data to third parties.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Data Storage</h2>
          <p>
            We store minimal authentication information (OAuth tokens) necessary to access your calendar data. 
            Your actual calendar events are fetched directly from Google Calendar and displayed in your browser.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Your Rights</h2>
          <p>
            You can revoke access to your Google Calendar at any time through your Google Account settings 
            or by disconnecting your account within the application.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Contact</h2>
          <p>
            If you have questions about this privacy policy, please contact: gabe@valdivia.works
          </p>
        </section>
      </div>
    </div>
  );
}



