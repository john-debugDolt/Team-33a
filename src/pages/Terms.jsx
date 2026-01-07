import { Link } from 'react-router-dom';
import './Terms.css';

export default function Terms() {
  return (
    <div className="terms-page">
      <div className="terms-container">
        <Link to="/" className="back-link">
          ← Back to Home
        </Link>

        <h1>Terms & Conditions</h1>
        <p className="last-updated">Last updated: January 2025</p>

        <div className="terms-content">
          <section>
            <h2>1. Introduction</h2>
            <p>
              Welcome to Team33. These Terms and Conditions govern your use of our website and services.
              By accessing or using our platform, you agree to be bound by these terms. If you disagree
              with any part of these terms, you may not access the service.
            </p>
          </section>

          <section>
            <h2>2. Eligibility</h2>
            <p>To use our services, you must:</p>
            <ul>
              <li>Be at least 18 years of age or the legal gambling age in your jurisdiction</li>
              <li>Have the legal capacity to enter into a binding agreement</li>
              <li>Not be a resident of any jurisdiction where online gambling is prohibited</li>
              <li>Provide accurate and complete registration information</li>
            </ul>
          </section>

          <section>
            <h2>3. Account Registration</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account. You must immediately notify us
              of any unauthorized use of your account.
            </p>
            <ul>
              <li>Only one account per person is permitted</li>
              <li>Account information must be accurate and up-to-date</li>
              <li>Sharing accounts is strictly prohibited</li>
              <li>We reserve the right to suspend or terminate accounts at our discretion</li>
            </ul>
          </section>

          <section>
            <h2>4. Deposits and Withdrawals</h2>
            <p>
              All deposits and withdrawals are subject to our payment processing policies:
            </p>
            <ul>
              <li>Minimum deposit: $10</li>
              <li>Minimum withdrawal: $20</li>
              <li>Withdrawals are processed within 24-48 hours</li>
              <li>We may require identity verification before processing withdrawals</li>
              <li>All transactions are final and non-refundable</li>
            </ul>
          </section>

          <section>
            <h2>5. Bonuses and Promotions</h2>
            <p>
              All bonuses and promotions are subject to specific terms and conditions:
            </p>
            <ul>
              <li>Wagering requirements must be met before withdrawal</li>
              <li>Bonuses may expire if not used within the specified period</li>
              <li>We reserve the right to modify or cancel promotions at any time</li>
              <li>Abuse of bonus offers may result in account termination</li>
            </ul>
          </section>

          <section>
            <h2>6. Responsible Gaming</h2>
            <p>
              We are committed to promoting responsible gaming. We encourage you to:
            </p>
            <ul>
              <li>Set deposit and betting limits</li>
              <li>Take regular breaks from gaming</li>
              <li>Never chase losses</li>
              <li>Seek help if gambling becomes a problem</li>
            </ul>
            <p>
              If you need assistance, please contact our support team or visit organizations
              like Gamblers Anonymous.
            </p>
          </section>

          <section>
            <h2>7. Prohibited Activities</h2>
            <p>The following activities are strictly prohibited:</p>
            <ul>
              <li>Fraud or attempted fraud</li>
              <li>Money laundering</li>
              <li>Use of automated software or bots</li>
              <li>Collusion with other players</li>
              <li>Exploiting system vulnerabilities</li>
              <li>Creating multiple accounts</li>
            </ul>
          </section>

          <section>
            <h2>8. Intellectual Property</h2>
            <p>
              All content on this platform, including logos, graphics, and software, is the property
              of Team33 or its licensors. You may not reproduce, distribute, or create derivative
              works without our express written consent.
            </p>
          </section>

          <section>
            <h2>9. Limitation of Liability</h2>
            <p>
              Team33 shall not be liable for any indirect, incidental, special, consequential,
              or punitive damages resulting from your use of or inability to use the service.
              Our total liability shall not exceed the amount you deposited in the past 12 months.
            </p>
          </section>

          <section>
            <h2>10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. We will notify users of
              significant changes via email or through our platform. Continued use of our
              services after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2>11. Contact Us</h2>
            <p>
              If you have any questions about these Terms and Conditions, please contact us:
            </p>
            <ul>
              <li>Email: support@team33.com</li>
              <li>Live Chat: Available 24/7</li>
            </ul>
          </section>
        </div>

        <div className="terms-footer">
          <p>By using our services, you acknowledge that you have read and understood these terms.</p>
          <Link to="/" className="btn-primary">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
