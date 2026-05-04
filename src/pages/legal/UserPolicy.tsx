import LegalLayout from "./LegalLayout";

export default function UserPolicy() {
  return (
    <LegalLayout title="User Policy" lastUpdated="May 4, 2026">
      <p>
        This User Policy governs how authorized users may access and use the RaizeChem Admin and RaizeChem Field
        applications.
      </p>

      <h2>Authorized use only</h2>
      <p>
        Access is restricted to approved personnel, administrators, and authorized representatives of RaizeChem. You
        must not use the app if you do not have explicit permission.
      </p>

      <h2>Account security</h2>
      <ul>
        <li>Keep your login credentials confidential.</li>
        <li>Do not share accounts, passwords, or verification details with unauthorized persons.</li>
        <li>Report any suspected unauthorized access immediately to your administrator.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>Use the app only for legitimate company business and approved field operations.</li>
        <li>Enter accurate business data for visits, orders, payments, and operational records.</li>
        <li>Use GPS, check-in, and photo features only for genuine work-related activities.</li>
      </ul>

      <h2>Prohibited conduct</h2>
      <ul>
        <li>Attempting to bypass access controls, permissions, or role restrictions.</li>
        <li>Uploading false, misleading, abusive, unlawful, or irrelevant content.</li>
        <li>Using the app to track people or collect data for non-business purposes.</li>
        <li>Reverse engineering, scraping, or attempting to disrupt app operations.</li>
      </ul>

      <h2>Location and device usage</h2>
      <p>
        If your role requires field operations, you may be required to enable location access while on duty. Disabling
        required permissions may limit your ability to use certain workflows.
      </p>

      <h2>Company data and ownership</h2>
      <p>
        Data entered into the app for operational use, including visit logs, dealer information, orders, and payment
        records, is treated as company business data and may be reviewed by authorized administrators.
      </p>

      <h2>Enforcement</h2>
      <p>
        RaizeChem may suspend or revoke access, investigate misuse, and take administrative or legal action where
        necessary to protect users, business operations, and company systems.
      </p>

      <h2>Policy updates</h2>
      <p>
        RaizeChem may update this policy from time to time. Continued use of the app after updates means you agree to
        the revised policy.
      </p>
    </LegalLayout>
  );
}
