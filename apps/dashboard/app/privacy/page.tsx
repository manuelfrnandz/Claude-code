export const metadata = {
  title: 'Privacy Policy — Data House',
  description: 'Privacy Policy for Data House WhatsApp AI chatbot service.',
};

export default function PrivacyPage() {
  const lastUpdated = 'May 15, 2025';

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9fafb', color: '#111827' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px' }}>Privacy Policy</h1>
            <p style={{ color: '#6b7280', margin: 0 }}>Last updated: {lastUpdated}</p>
          </div>

          <section style={sectionStyle}>
            <h2 style={h2Style}>1. About Data House</h2>
            <p style={pStyle}>
              Data House ("<strong>we</strong>", "<strong>us</strong>", or "<strong>our</strong>") is a
              business automation company based in Panama that provides AI-powered WhatsApp chatbot
              services to businesses. This Privacy Policy explains how we collect, use, and protect
              information when you interact with our WhatsApp bots or use our platform.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>2. Information We Collect</h2>
            <p style={pStyle}>When you interact with a Data House WhatsApp chatbot, we may collect:</p>
            <ul style={ulStyle}>
              <li style={liStyle}><strong>Phone number</strong> — used to identify your conversation and send replies.</li>
              <li style={liStyle}><strong>Message content</strong> — text and audio messages you send to the bot, used to generate responses.</li>
              <li style={liStyle}><strong>Conversation history</strong> — stored to provide context for ongoing conversations.</li>
              <li style={liStyle}><strong>Intent data</strong> — inferred categories (e.g., sales, support) to route your inquiry correctly.</li>
              <li style={liStyle}><strong>Name and email</strong> — only if you voluntarily provide them during the conversation.</li>
            </ul>
            <p style={pStyle}>
              We do <strong>not</strong> collect payment information, government IDs, or any sensitive
              personal data through our chatbot.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>3. How We Use Your Information</h2>
            <p style={pStyle}>We use the information collected to:</p>
            <ul style={ulStyle}>
              <li style={liStyle}>Respond to your messages and provide customer service on behalf of our clients.</li>
              <li style={liStyle}>Maintain conversation context so you don't have to repeat yourself.</li>
              <li style={liStyle}>Improve the accuracy and quality of our AI responses.</li>
              <li style={liStyle}>Allow our clients (the businesses using Data House) to review conversations and follow up with leads.</li>
            </ul>
            <p style={pStyle}>We do <strong>not</strong> sell your personal data to third parties.</p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>4. WhatsApp and Meta</h2>
            <p style={pStyle}>
              Our chatbots operate through the <strong>WhatsApp Business Platform</strong> provided by
              Meta Platforms, Inc. By messaging a Data House bot on WhatsApp, you are also subject to
              WhatsApp's{' '}
              <a href="https://www.whatsapp.com/legal/privacy-policy" style={linkStyle}>
                Privacy Policy
              </a>
              . We access your messages via the Meta Cloud API solely to provide the chatbot service.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>5. Data Storage and Security</h2>
            <p style={pStyle}>
              Conversation data is stored in a secure database (Supabase / PostgreSQL) hosted on
              cloud infrastructure. We apply industry-standard security measures including encryption
              in transit (TLS) and access controls. Data is retained for as long as the business
              relationship with our client requires, or until you request deletion.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>6. Data Sharing</h2>
            <p style={pStyle}>We share your information only with:</p>
            <ul style={ulStyle}>
              <li style={liStyle}><strong>Our clients</strong> — the businesses that deployed the chatbot you interacted with.</li>
              <li style={liStyle}><strong>OpenAI</strong> — message content is sent to OpenAI's API to generate AI responses. OpenAI's{' '}
                <a href="https://openai.com/policies/privacy-policy" style={linkStyle}>Privacy Policy</a> applies.</li>
              <li style={liStyle}><strong>Infrastructure providers</strong> — Supabase (database) and Railway (hosting), bound by their own privacy commitments.</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>7. Your Rights</h2>
            <p style={pStyle}>You have the right to:</p>
            <ul style={ulStyle}>
              <li style={liStyle}>Request access to the personal data we hold about you.</li>
              <li style={liStyle}>Request correction or deletion of your data.</li>
              <li style={liStyle}>Opt out of future communications from the chatbot.</li>
            </ul>
            <p style={pStyle}>
              To exercise these rights, contact us at the email below. We will respond within 30 days.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>8. Cookies and Tracking</h2>
            <p style={pStyle}>
              Our WhatsApp chatbot does not use cookies. Our web dashboard may use session cookies
              strictly necessary for authentication. We do not use tracking or analytics cookies.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>9. Children's Privacy</h2>
            <p style={pStyle}>
              Our services are not directed to individuals under the age of 13. We do not knowingly
              collect personal data from children.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>10. Changes to This Policy</h2>
            <p style={pStyle}>
              We may update this Privacy Policy periodically. We will post the updated version on this
              page with a new "Last updated" date. Continued use of our services after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={h2Style}>11. Contact Us</h2>
            <p style={pStyle}>
              If you have any questions about this Privacy Policy or wish to exercise your data rights,
              please contact us:
            </p>
            <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '16px 20px', marginTop: 12 }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Data House</p>
              <p style={{ margin: '0 0 4px', color: '#374151' }}>Panama</p>
              <p style={{ margin: 0, color: '#374151' }}>
                Email:{' '}
                <a href="mailto:privacy@datahouse.ai" style={linkStyle}>
                  privacy@datahouse.ai
                </a>
              </p>
            </div>
          </section>
        </div>
      </body>
    </html>
  );
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 36,
  borderBottom: '1px solid #e5e7eb',
  paddingBottom: 32,
};

const h2Style: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  margin: '0 0 12px',
  color: '#111827',
};

const pStyle: React.CSSProperties = {
  lineHeight: 1.7,
  margin: '0 0 12px',
  color: '#374151',
};

const ulStyle: React.CSSProperties = {
  margin: '0 0 12px',
  paddingLeft: 24,
};

const liStyle: React.CSSProperties = {
  lineHeight: 1.7,
  marginBottom: 6,
  color: '#374151',
};

const linkStyle: React.CSSProperties = {
  color: '#059669',
  textDecoration: 'none',
};
