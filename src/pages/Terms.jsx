import { Link } from 'react-router-dom';
import './Terms.css';

export default function Terms() {
  return (
    <div className="terms-page">
      <div className="terms-container">
        <Link to="/" className="back-link">
          ← Back to Home
        </Link>

        <h1>Team33 Terms &amp; Conditions</h1>
        <p className="last-updated">Last updated: June 2026</p>

        <div className="terms-content">
          <section>
            <p>
              Welcome to Team33. By signing up, depositing, or playing on our platform
              you agree to the following terms. Please read them carefully — they set
              out what you can expect from us and what we expect from you.
            </p>
          </section>

          <section>
            <h2>1. About These Terms</h2>
            <p>
              These terms govern your use of Team33's services, including the website,
              mobile apps, games, and customer support channels. Continued use of the
              platform means you accept these rules and any updates we publish. If we
              find that a player has broken them, we may suspend or close the account.
            </p>
          </section>

          <section>
            <h2>2. Eligibility and Account Sign-up</h2>
            <h3>a. Age and jurisdiction</h3>
            <p>
              You must be at least 18 years old — or the legal gambling age in your
              country, whichever is higher. We may ask for proof of age at any time and
              will hold an account until you supply it.
            </p>
            <h3>b. How to register</h3>
            <ul>
              <li><strong>Sign up:</strong> tap the Sign Up button on the home page.</li>
              <li><strong>Your details:</strong> enter accurate name, contact and address information.</li>
              <li><strong>Phone verification:</strong> confirm your mobile with the one-time code we send by SMS.</li>
              <li><strong>Ready to play:</strong> once verified, your account is activated.</li>
            </ul>
            <p>
              Keep your login confidential. If you spot activity you don't recognise,
              tell our support team straight away.
            </p>
            <h3>c. One account per player</h3>
            <p>
              Each person may only hold one Team33 account. Duplicate accounts are not
              permitted and any we identify will be closed.
            </p>
          </section>

          <section>
            <h2>3. Deposits and Withdrawals</h2>
            <h3>a. Deposit limits</h3>
            <p>
              Minimum and maximum deposit amounts vary by payment method. Up-to-date
              details live on the Deposit page in your wallet.
            </p>
            <h3>b. Withdrawing your winnings</h3>
            <ul>
              <li><strong>Clear any wagering:</strong> finish the wagering requirements attached to a bonus before cashing out.</li>
              <li><strong>Verify your identity:</strong> complete our Know Your Customer (KYC) checks.</li>
              <li><strong>Request the payout:</strong> head to the Withdraw section, pick a method, and enter the amount.</li>
            </ul>
            <h3>c. KYC checks</h3>
            <ul>
              <li><strong>Documents we ask for:</strong> a valid photo ID, proof of address, and anything else our compliance team flags.</li>
              <li><strong>Turnaround:</strong> usually within 24 hours; longer if the documents are unclear or incomplete.</li>
            </ul>
            <h3>d. Processing times</h3>
            <ul>
              <li><strong>Deposits:</strong> credited instantly in most cases; a few methods can take longer.</li>
              <li><strong>Withdrawals:</strong> typically settled within 5 minutes. Payouts above AUD 10,000 may need a little extra checking time.</li>
            </ul>
          </section>

          <section>
            <h2>4. Bonuses and Wagering</h2>
            <h3>a. Welcome bonus eligibility</h3>
            <p>
              New, verified players qualify for the welcome bonus. The full list of
              current offers and their conditions sits on the Promotions page.
            </p>
            <h3>b. Wagering requirements</h3>
            <p>
              Every bonus carries a wagering requirement — the amount you must bet
              before bonus-related winnings can be withdrawn. As an example, a AUD 30
              bonus at 10× wagering means AUD 300 of bets first.
            </p>
            <h3>c. Bonus abuse</h3>
            <p>
              Stacking bonuses through duplicate accounts, abusing risk-free patterns,
              or exploiting promotion mechanics is not allowed. We may void bonuses,
              reclaim winnings, and close the account where abuse is detected.
            </p>
          </section>

          <section>
            <h2>5. Fair Play and Responsible Gambling</h2>
            <h3>a. Fair play and anti-fraud</h3>
            <p>
              Players are expected to play fairly. Collusion, automated tools, bots,
              and any attempt to exploit a game or our systems are prohibited and will
              cost both the winnings and the account.
            </p>
            <h3>b. Responsible gambling tools</h3>
            <ul>
              <li><strong>Self-exclusion:</strong> pause or block your own access, temporarily or permanently.</li>
              <li><strong>Deposit limits:</strong> set daily, weekly, or monthly caps.</li>
              <li><strong>Reality checks:</strong> get reminders about how long you have been playing.</li>
            </ul>
            <p>
              Our support team is available 24/7 if you need help configuring any of
              these or want to talk through your play habits.
            </p>
          </section>

          <section>
            <h2>6. Account Security</h2>
            <h3>a. Passwords</h3>
            <p>
              Use a unique, strong password, change it regularly, and never share it
              with anyone. Take extra care on shared or public devices.
            </p>
            <h3>b. If you suspect a breach</h3>
            <ul>
              <li><strong>Reset:</strong> change your password immediately.</li>
              <li><strong>Tell us:</strong> contact support so we can lock things down and review activity.</li>
            </ul>
          </section>

          <section>
            <h2>7. Restricted Countries</h2>
            <p>
              Team33 isn't available in every jurisdiction. It's your responsibility to
              know your local laws before signing up. Accounts opened from a restricted
              region may be closed and balances handled in line with applicable law.
            </p>
          </section>

          <section>
            <h2>8. Account Suspension and Closure</h2>
            <p>
              We may suspend or close an account if a player:
            </p>
            <ul>
              <li>Breaks any part of these terms.</li>
              <li>Engages in fraud or other illegal activity.</li>
              <li>Provides false or misleading information when registering or verifying.</li>
            </ul>
            <p>
              Affected players are notified by email at the address on file.
            </p>
          </section>

          <section>
            <h2>9. Privacy</h2>
            <p>
              We collect and process personal data in line with our Privacy Policy and
              applicable law. Your information is used to deliver and improve the
              service and isn't shared with third parties unless legally required.
            </p>
          </section>

          <section>
            <h2>10. Intellectual Property</h2>
            <p>
              All content on Team33 — text, images, logos, code — belongs to Team33 or
              our licensors and is protected by intellectual-property law. Copying,
              redistributing, or reusing it without permission isn't allowed.
            </p>
          </section>

          <section>
            <h2>11. Disclaimer</h2>
            <p>
              We work hard to keep the platform secure and reliable, but we can't
              guarantee uninterrupted, error-free service. Team33 is not liable for:
            </p>
            <ul>
              <li>Service outages outside our reasonable control.</li>
              <li>Unauthorised access that results from a player's own credential lapse.</li>
              <li>Errors or omissions in third-party content.</li>
            </ul>
            <p>
              Use of the service is at your own risk and discretion.
            </p>
          </section>

          <section>
            <h2>12. Updates to These Terms</h2>
            <p>
              We may update these terms from time to time. Material changes will be
              announced on the site or sent to the email address on your account.
              Continuing to use Team33 after a change means you accept the updated
              version.
            </p>
          </section>

          <section>
            <h2>13. Support and Contact</h2>
            <p>
              Questions about these terms or anything else? Reach out:
            </p>
            <ul>
              <li><strong>Live Chat:</strong> available 24/7 from the chat button on the site.</li>
              <li><strong>Telegram:</strong> @Team33</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
