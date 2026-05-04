import LegalLayout from "./LegalLayout";

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="May 4, 2026">
      <p>
        This Privacy Policy explains how RaizeChem collects, uses, stores, and protects data when employees,
        contractors, and authorized users access the RaizeChem Admin and RaizeChem Field applications.
      </p>

      <h2>Who this policy applies to</h2>
      <p>
        This app is intended for authorized business use by RaizeChem personnel and approved users only. It is not a
        consumer-facing public marketplace app.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account details such as name, business email address, and role-based access information.</li>
        <li>Location data when duty tracking, check-in, check-out, and live field tracking features are used.</li>
        <li>Photos uploaded during field visits, such as proof-of-visit or related field documentation.</li>
        <li>Operational data entered into the app, including dealer interactions, orders, payments, and visit notes.</li>
        <li>Technical information needed for security, authentication, diagnostics, and service reliability.</li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To authenticate users and control access based on job responsibilities.</li>
        <li>To support field sales operations, visit tracking, order collection, and payment recording.</li>
        <li>To monitor active duty sessions and improve dispatch, supervision, and operational visibility.</li>
        <li>To maintain auditability, prevent misuse, and support internal business reporting.</li>
        <li>To troubleshoot service issues and maintain platform security.</li>
      </ul>

      <h2>Location and background access</h2>
      <p>
        When enabled by the user and required for field operations, the app may collect precise and background location
        data while duty is active. This is used for duty session tracking, route visibility, check-in/check-out
        verification, and operational reporting.
      </p>

      <h2>Photo uploads</h2>
      <p>
        Photos captured in the app are used only for legitimate business workflows, such as visit proof and field
        documentation. Uploaded files are stored in RaizeChem-managed infrastructure with authenticated access controls
        or time-limited access links where applicable.
      </p>

      <h2>Data sharing</h2>
      <p>
        RaizeChem does not sell personal data collected through this app. Data may be processed through trusted service
        providers that support hosting, authentication, storage, security, and application operations.
      </p>

      <h2>Data retention</h2>
      <p>
        Data is retained only for as long as reasonably necessary for operational, compliance, audit, and support
        purposes, subject to internal company policy and applicable law.
      </p>

      <h2>Security</h2>
      <p>
        We use reasonable administrative, technical, and organizational safeguards to protect data against unauthorized
        access, misuse, alteration, or loss. However, no digital system can guarantee absolute security.
      </p>

      <h2>User responsibilities</h2>
      <p>
        Users must protect their login credentials, use the app only for authorized business work, and avoid uploading
        inaccurate, unlawful, or unnecessary personal content.
      </p>

      <h2>Your choices</h2>
      <p>
        If you are an authorized user and have questions about your data, access permissions, or corrections, please
        contact your RaizeChem administrator or internal support team.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy-related questions, please contact RaizeChem through the official support or business contact
        channels published by the company.
      </p>
    </LegalLayout>
  );
}
