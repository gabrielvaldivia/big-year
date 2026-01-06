export default function TermsPage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <div className="prose prose-slate">
        <p className="text-sm text-gray-600 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
        
        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Acceptance of Terms</h2>
          <p>
            By using Big Year, you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, please do not use the service.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Description of Service</h2>
          <p>
            Big Year is a calendar application that displays all-day events from your Google Calendar 
            in a full-year view. The service requires access to your Google Calendar data to function.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">User Responsibilities</h2>
          <p>
            You are responsible for maintaining the security of your account and for all activities 
            that occur under your account. You agree to use the service only for lawful purposes.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Service Availability</h2>
          <p>
            We strive to provide reliable service but do not guarantee uninterrupted or error-free operation. 
            The service may be temporarily unavailable due to maintenance or technical issues.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Limitation of Liability</h2>
          <p>
            Big Year is provided "as is" without warranties of any kind. We are not liable for any 
            damages arising from your use of the service.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">Contact</h2>
          <p>
            If you have questions about these terms, please contact: gabe@valdivia.works
          </p>
        </section>
      </div>
    </div>
  );
}



