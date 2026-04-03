import { Resend } from "resend";
import { escapeHtml } from "@/lib/sanitize";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Resolve the application base URL from available env vars
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

// Email sending utility
export async function sendEmail({
  to,
  subject,
  html,
  from = "PartsIQ <onboarding@partsiqai.com>",
  headers: customHeaders,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  headers?: Record<string, string>;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      headers: customHeaders,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log("Email sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

// Verification email template
export function getVerificationEmailHtml(name: string, verificationUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - PartsIQ</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    .header {
      background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #1e293b;
      margin: 0 0 20px 0;
      font-size: 24px;
    }
    .content p {
      margin: 0 0 20px 0;
      color: #475569;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%);
      color: white !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .info-box {
      background: #f1f5f9;
      border-left: 4px solid #9333ea;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
    }
    .footer {
      background: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 0 0 10px 0;
      font-size: 13px;
      color: #64748b;
    }
    .footer a {
      color: #9333ea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ Welcome to PartsIQ AI</h1>
    </div>

    <div class="content">
      <h2>Hi ${escapeHtml(name)}! 👋</h2>

      <p>Thanks for signing up for PartsIQ! We're excited to have you on board.</p>

      <p>To get started, please verify your email address by clicking the button below:</p>

      <div style="text-align: center;">
        <a href="${verificationUrl}" class="button">
          Verify Email Address
        </a>
      </div>

      <div class="info-box">
        <p><strong>⏰ This link expires in 24 hours</strong></p>
        <p>If you didn't create an account with PartsIQ, you can safely ignore this email.</p>
      </div>

      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #9333ea; font-size: 14px;">${verificationUrl}</p>
    </div>

    <div class="footer">
      <p>Need help? <a href="mailto:support@partsiq.com">Contact our support team</a></p>
      <p>© ${new Date().getFullYear()} PartsIQ AI. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}

// Welcome email with API setup instructions
export function getWelcomeEmailHtml(name: string, companyName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to PartsIQ - Setup Guide</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 650px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    .header {
      background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      color: rgba(255, 255, 255, 0.9);
      margin: 10px 0 0 0;
      font-size: 16px;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #1e293b;
      margin: 30px 0 15px 0;
      font-size: 22px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 10px;
    }
    .content h2:first-child {
      margin-top: 0;
    }
    .content p {
      margin: 0 0 15px 0;
      color: #475569;
    }
    .api-section {
      background: #f8fafc;
      border-left: 4px solid #06b6d4;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .api-section h3 {
      margin: 0 0 10px 0;
      color: #1e293b;
      font-size: 18px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .api-section p {
      margin: 0 0 10px 0;
      font-size: 14px;
    }
    .api-section ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .api-section li {
      margin: 5px 0;
      font-size: 14px;
      color: #475569;
    }
    .api-section code {
      background: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #9333ea;
    }
    .api-section a {
      color: #9333ea;
      text-decoration: none;
      font-weight: 500;
    }
    .api-section a:hover {
      text-decoration: underline;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%);
      color: white !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .checklist {
      background: #f1f5f9;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .checklist ul {
      margin: 10px 0 0 0;
      padding-left: 20px;
    }
    .checklist li {
      margin: 8px 0;
      color: #475569;
    }
    .tip-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .tip-box p {
      margin: 0;
      font-size: 14px;
      color: #92400e;
    }
    .footer {
      background: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 0 0 10px 0;
      font-size: 13px;
      color: #64748b;
    }
    .footer a {
      color: #9333ea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to PartsIQ AI!</h1>
      <p>Your 14-day free trial starts now</p>
    </div>

    <div class="content">
      <h2>Hi ${escapeHtml(name)}!</h2>

      <p>Welcome to PartsIQ! Your account for <strong>${escapeHtml(companyName)}</strong> has been successfully created.</p>

      <p>To unlock the full power of PartsIQ's AI-driven parts search and maintenance management, you'll need to configure a few integrations. Don't worry – we've made it super easy!</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${getBaseUrl()}/login" class="button">
          Go to Dashboard
        </a>
      </div>

      <h2>🔧 Required Integrations Setup</h2>

      <p>Here's what you'll need to configure to get the most out of PartsIQ:</p>

      <!-- OpenRouter Integration -->
      <div class="api-section">
        <h3>🤖 OpenRouter (AI Chat)</h3>
        <p><strong>What it does:</strong> Powers the intelligent AI assistant that helps you search for parts and get maintenance recommendations.</p>

        <p><strong>Setup Steps:</strong></p>
        <ul>
          <li>Visit <a href="https://openrouter.ai" target="_blank">openrouter.ai</a> and create an account</li>
          <li>Navigate to "Keys" in your dashboard</li>
          <li>Click "Create Key" and copy your API key</li>
          <li>In PartsIQ, go to <strong>Settings → Integrations → OpenRouter</strong></li>
          <li>Paste your API key and click "Save"</li>
        </ul>

        <p><strong>Cost:</strong> Pay-as-you-go. Typical costs: $0.50-$2.00 per 1,000 chat queries.</p>
      </div>

      <!-- Pinecone Integration -->
      <div class="api-section">
        <h3>🔍 Pinecone (Semantic Search)</h3>
        <p><strong>What it does:</strong> Enables intelligent semantic search across your parts catalogs and maintenance documents.</p>

        <p><strong>Setup Steps:</strong></p>
        <ul>
          <li>Create a free account at <a href="https://www.pinecone.io" target="_blank">pinecone.io</a></li>
          <li>Create a new index with dimensions: <code>1536</code> (for OpenAI embeddings)</li>
          <li>Go to "API Keys" and copy your API key</li>
          <li>Note your index name and environment</li>
          <li>In PartsIQ: <strong>Settings → Integrations → Pinecone</strong></li>
          <li>Enter API Key, Index Name, and Environment</li>
        </ul>

        <p><strong>Cost:</strong> Free tier includes 1M vectors. Perfect for getting started!</p>
      </div>

      <!-- Neo4j Integration -->
      <div class="api-section">
        <h3>🕸️ Neo4j (Compatibility Graph)</h3>
        <p><strong>What it does:</strong> Maps part compatibility relationships to ensure you order the right components.</p>

        <p><strong>Setup Steps:</strong></p>
        <ul>
          <li>Create a free AuraDB instance at <a href="https://neo4j.com/cloud/aura/" target="_blank">neo4j.com/cloud/aura</a></li>
          <li>Save your connection URI (starts with <code>neo4j+s://</code>)</li>
          <li>Save your username (default: <code>neo4j</code>) and password</li>
          <li>In PartsIQ: <strong>Settings → Integrations → Neo4j</strong></li>
          <li>Enter URI, Username, and Password</li>
        </ul>

        <p><strong>Cost:</strong> Free tier available with 200K nodes. Great for testing!</p>
      </div>

      <!-- Email Integration -->
      <div class="api-section">
        <h3>📧 Email Integration (Supplier Communication)</h3>
        <p><strong>What it does:</strong> Automatically send quote requests to suppliers and track responses.</p>

        <p><strong>Setup Options:</strong></p>
        <ul>
          <li><strong>Gmail OAuth:</strong> Connect your Google Workspace or Gmail account</li>
          <li><strong>Microsoft OAuth:</strong> Connect your Microsoft 365 or Outlook account</li>
          <li><strong>SMTP:</strong> Use any email provider with SMTP settings</li>
        </ul>

        <p>Configure in: <strong>Settings → Email Integration</strong></p>
      </div>

      <div class="tip-box">
        <p><strong>💡 Pro Tip:</strong> Start with OpenRouter and Pinecone first – these power the core AI features. You can add Neo4j and email integration later as you scale.</p>
      </div>

      <h2>✅ Quick Start Checklist</h2>

      <div class="checklist">
        <p><strong>Complete these steps to get started:</strong></p>
        <ul>
          <li>✓ Email verified (done!)</li>
          <li>☐ Configure OpenRouter API (5 minutes)</li>
          <li>☐ Set up Pinecone vector search (10 minutes)</li>
          <li>☐ Add your first vehicle to the fleet</li>
          <li>☐ Start your first AI chat to search for parts</li>
          <li>☐ Invite team members (optional)</li>
        </ul>
      </div>

      <h2>📚 Resources</h2>

      <p>Need help getting started?</p>
      <ul>
        <li><a href="${getBaseUrl()}/docs">Documentation & Guides</a></li>
        <li><a href="${getBaseUrl()}/support">Contact Support</a></li>
        <li><a href="mailto:support@partsiq.com">Email: support@partsiq.com</a></li>
      </ul>

      <h2>🚀 What's Next?</h2>

      <p>Once you've configured your integrations:</p>
      <ol>
        <li>Add your first vehicle or equipment to start tracking</li>
        <li>Upload maintenance schedules (PDFs supported)</li>
        <li>Try the AI chat to search for parts</li>
        <li>Send your first quote request to suppliers</li>
      </ol>

      <p>Your 14-day free trial gives you full access to all features. No credit card required!</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${getBaseUrl()}/login" class="button">
          Get Started Now
        </a>
      </div>
    </div>

    <div class="footer">
      <p>Questions? We're here to help! <a href="mailto:support@partsiq.com">support@partsiq.com</a></p>
      <p>© ${new Date().getFullYear()} PartsIQ AI. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}

// Master admin notification email
export function getMasterAdminNotificationHtml(
  companyName: string,
  contactName: string,
  email: string,
  phone: string,
  industry: string,
  companySize: string,
  primaryUseCase: string,
  trialEndsAt: Date
): string {
  const dashboardUrl = `${getBaseUrl()}/admin/tenants`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Organization Signup - ${escapeHtml(companyName)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    .header {
      background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
      padding: 30px;
      color: white;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px;
    }
    .info-grid {
      display: grid;
      gap: 15px;
      margin: 20px 0;
    }
    .info-item {
      display: flex;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 10px;
    }
    .info-label {
      font-weight: 600;
      color: #64748b;
      min-width: 140px;
    }
    .info-value {
      color: #1e293b;
    }
    .use-case-box {
      background: #f1f5f9;
      padding: 15px;
      border-radius: 6px;
      margin: 15px 0;
    }
    .use-case-box p {
      margin: 0;
      font-style: italic;
      color: #475569;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
      color: white !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .trial-alert {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 New Organization Signup</h1>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">A new company has signed up for PartsIQ</p>
    </div>

    <div class="content">
      <h2 style="margin-top: 0;">Organization Details</h2>

      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Company:</span>
          <span class="info-value"><strong>${escapeHtml(companyName)}</strong></span>
        </div>
        <div class="info-item">
          <span class="info-label">Contact Name:</span>
          <span class="info-value">${escapeHtml(contactName)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Email:</span>
          <span class="info-value"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></span>
        </div>
        <div class="info-item">
          <span class="info-label">Phone:</span>
          <span class="info-value"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></span>
        </div>
        <div class="info-item">
          <span class="info-label">Industry:</span>
          <span class="info-value">${escapeHtml(industry)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Company Size:</span>
          <span class="info-value">${escapeHtml(companySize)} employees</span>
        </div>
      </div>

      <h3>Primary Use Case:</h3>
      <div class="use-case-box">
        <p>"${escapeHtml(primaryUseCase)}"</p>
      </div>

      <div class="trial-alert">
        <p style="margin: 0;"><strong>⏰ Trial Period:</strong> ${trialEndsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px;">14 days from signup</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardUrl}" class="button">View in Admin Dashboard</a>
      </div>

      <h3>Recommended Follow-up Actions:</h3>
      <ul style="color: #475569;">
        <li>Send personalized welcome email within 24 hours</li>
        <li>Schedule onboarding call if company size > 50 employees</li>
        <li>Monitor integration setup progress</li>
        <li>Check in at day 7 of trial</li>
        <li>Conversion outreach at day 12 of trial</li>
      </ul>
    </div>
  </div>
</body>
</html>
`;
}

// Password reset email template
export function getPasswordResetEmailHtml(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - PartsIQ</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    .header {
      background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #1e293b;
      margin: 0 0 20px 0;
      font-size: 24px;
    }
    .content p {
      margin: 0 0 20px 0;
      color: #475569;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%);
      color: white !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .info-box {
      background: #f1f5f9;
      border-left: 4px solid #9333ea;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
    }
    .footer {
      background: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 0 0 10px 0;
      font-size: 13px;
      color: #64748b;
    }
    .footer a {
      color: #9333ea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset</h1>
    </div>

    <div class="content">
      <h2>Hi ${escapeHtml(name)},</h2>

      <p>We received a request to reset your PartsIQ password. Click the button below to set a new password:</p>

      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">
          Reset Password
        </a>
      </div>

      <div class="info-box">
        <p><strong>This link expires in 1 hour.</strong></p>
        <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      </div>

      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #9333ea; font-size: 14px;">${resetUrl}</p>
    </div>

    <div class="footer">
      <p>Need help? <a href="mailto:support@partsiq.com">Contact our support team</a></p>
      <p>&copy; ${new Date().getFullYear()} PartsIQ AI. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}

// ─── Admin Communication Templates ──────────────────────────────────

function adminEmailShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 700; }
    .content { padding: 32px 40px; }
    .content h2 { color: #1e293b; margin: 0 0 20px 0; font-size: 20px; }
    .content p { margin: 0 0 16px 0; color: #475569; line-height: 1.6; font-size: 15px; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%); color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .info-box { background: #f1f5f9; border-left: 4px solid #9333ea; padding: 16px 20px; margin: 20px 0; border-radius: 4px; }
    .info-box p { margin: 0 0 8px 0; font-size: 14px; color: #475569; }
    .info-box p:last-child { margin-bottom: 0; }
    .checklist { list-style: none; padding: 0; margin: 16px 0; }
    .checklist li { padding: 8px 0; color: #475569; font-size: 14px; }
    .checklist li::before { content: "\\2713\\0020"; color: #9333ea; font-weight: bold; }
    .footer { padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 0 0 8px 0; font-size: 13px; color: #94a3b8; }
    .footer a { color: #9333ea; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${escapeHtml(title)}</h1></div>
    <div class="content">${body}</div>
    <div class="footer">
      <p>Sent by the PartsIQ team</p>
      <p>Need help? <a href="mailto:support@partsiqai.com">Contact support</a></p>
      <p>&copy; ${new Date().getFullYear()} PartsIQ AI. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

export function getWelcomeFollowupEmailHtml(recipientName: string, orgName: string, dashboardUrl: string): string {
  const body = `
    <h2>Hi ${escapeHtml(recipientName)},</h2>
    <p>Welcome to PartsIQ! I wanted to personally check in and see how things are going with <strong>${escapeHtml(orgName)}</strong>.</p>
    <p>If you haven't already, here are the key steps to get the most out of your account:</p>
    <ul class="checklist">
      <li>Add your first vehicle to enable parts search</li>
      <li>Upload a parts catalog for your equipment</li>
      <li>Add your suppliers for quote automation</li>
      <li>Invite your team members</li>
    </ul>
    <p>If you need any help getting set up, just reply to this email — I'm happy to assist.</p>
    <div style="text-align: center;">
      <a href="${escapeHtml(dashboardUrl)}" class="button">Go to Dashboard</a>
    </div>
  `;
  return adminEmailShell("Following Up on Your Account", body);
}

export function getTrialExpiringEmailHtml(recipientName: string, orgName: string, daysLeft: number, upgradeUrl: string): string {
  const urgency = daysLeft <= 3 ? "Your trial is ending very soon!" : "Your trial is wrapping up.";
  const body = `
    <h2>Hi ${escapeHtml(recipientName)},</h2>
    <p>${urgency} <strong>${escapeHtml(orgName)}</strong> has <strong>${daysLeft} day${daysLeft !== 1 ? "s" : ""}</strong> remaining on the free trial.</p>
    <p>When the trial ends, your team will lose access to:</p>
    <ul class="checklist">
      <li>AI-powered parts search</li>
      <li>Automated supplier quote requests</li>
      <li>Voice agent calling</li>
      <li>Parts catalog and inventory management</li>
    </ul>
    <div class="info-box">
      <p><strong>Upgrade now to keep everything running.</strong></p>
      <p>All your data, vehicles, and supplier connections will be preserved when you subscribe.</p>
    </div>
    <div style="text-align: center;">
      <a href="${escapeHtml(upgradeUrl)}" class="button">Upgrade Now</a>
    </div>
    <p>Have questions about pricing or features? Just reply to this email.</p>
  `;
  return adminEmailShell("Your Trial Ends Soon", body);
}

export function getSetupHelpEmailHtml(recipientName: string, orgName: string, dashboardUrl: string): string {
  const body = `
    <h2>Hi ${escapeHtml(recipientName)},</h2>
    <p>I noticed <strong>${escapeHtml(orgName)}</strong> might still be getting set up on PartsIQ. I wanted to reach out and offer some help.</p>
    <p>Here's what most teams do in their first week:</p>
    <div class="info-box">
      <p><strong>1. Add your equipment</strong> — Register the vehicles and machines your team works on.</p>
      <p><strong>2. Upload parts catalogs</strong> — Import CSV data so your team can search by part number or description.</p>
      <p><strong>3. Add suppliers</strong> — Connect your parts suppliers for automated quote requests.</p>
      <p><strong>4. Try a search</strong> — Use the AI chat to find parts for your equipment.</p>
    </div>
    <p>If you'd like a quick walkthrough or have any questions, just reply to this email and we'll get you sorted.</p>
    <div style="text-align: center;">
      <a href="${escapeHtml(dashboardUrl)}" class="button">Go to Dashboard</a>
    </div>
  `;
  return adminEmailShell("Need Help Setting Up?", body);
}

export function getCustomAdminEmailHtml(recipientName: string, subject: string, bodyContent: string): string {
  const body = `
    <h2>Hi ${escapeHtml(recipientName)},</h2>
    ${bodyContent.split('\n').filter(l => l.trim()).map(line => `<p>${escapeHtml(line)}</p>`).join('\n    ')}
  `;
  return adminEmailShell(subject, body);
}

// --- Trial Reminder Email Templates (cron-based) ---

function trialEmailShell(title: string, body: string): string {
  const baseUrl = getBaseUrl();
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07); }
    .header { background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .content p { margin: 0 0 15px; color: #475569; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%); color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .footer { background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 0 0 8px; font-size: 13px; color: #64748b; }
    .footer a { color: #9333ea; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    ${body}
    <div class="footer">
      <p>Questions? <a href="mailto:support@partsiqai.com">support@partsiqai.com</a></p>
      <p>&copy; ${new Date().getFullYear()} PartsIQ AI. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// Day 7: Mid-trial check-in
export function getTrialCheckInEmailHtml(name: string, companyName: string, daysLeft: number): string {
  const baseUrl = getBaseUrl();
  return trialEmailShell("How's your setup going?", `
    <div class="header"><h1>How's it going, ${escapeHtml(name)}?</h1></div>
    <div class="content">
      <p>You've had <strong>${escapeHtml(companyName)}</strong> on PartsIQ for a week now. You have <strong>${daysLeft} days</strong> left in your free trial.</p>
      <p>Here are a few things to make the most of your remaining trial:</p>
      <ul style="color: #475569;">
        <li><strong>Invite your team</strong> &mdash; Managers and Technicians can search parts and create quote requests</li>
        <li><strong>Add your vehicles</strong> &mdash; Track maintenance and parts per asset</li>
        <li><strong>Try the AI chat</strong> &mdash; Search your parts catalog with natural language</li>
      </ul>
      <p>Need help? Reply to this email or <a href="${baseUrl}/support" style="color: #9333ea;">visit our support page</a>.</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${baseUrl}/login" class="button">Go to Dashboard</a>
      </div>
    </div>
  `);
}

// Day 12: 2 days left
export function getTrialEndingSoonEmailHtml(name: string, companyName: string, daysLeft: number): string {
  const baseUrl = getBaseUrl();
  return trialEmailShell("Your trial ends in " + daysLeft + " days", `
    <div class="header"><h1>Your trial ends in ${daysLeft} days</h1></div>
    <div class="content">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your free trial for <strong>${escapeHtml(companyName)}</strong> ends in <strong>${daysLeft} days</strong>. To keep access to your data, vehicles, suppliers, and AI features, upgrade to a paid plan.</p>
      <p>Plans start at <strong>$199/month</strong> with a full 14-day money-back guarantee.</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${baseUrl}/admin/billing" class="button">Upgrade Now</a>
      </div>
      <p style="font-size: 14px; color: #64748b;">Your data is safe &mdash; even after the trial ends, we keep your data for 30 days so you can pick up right where you left off.</p>
    </div>
  `);
}

// Day 13: Last day
export function getTrialLastDayEmailHtml(name: string, companyName: string): string {
  const baseUrl = getBaseUrl();
  return trialEmailShell("Last day of your trial", `
    <div style="background: #dc2626; padding: 30px; text-align: center;"><h1 style="color: white; margin: 0; font-size: 24px;">Last day of your free trial</h1></div>
    <div class="content">
      <p>Hi ${escapeHtml(name)},</p>
      <p>This is your last day on the free trial for <strong>${escapeHtml(companyName)}</strong>. After today, your team will lose access to:</p>
      <ul style="color: #475569;">
        <li>AI-powered parts search and chat</li>
        <li>Quote requests and supplier management</li>
        <li>Vehicle tracking and maintenance scheduling</li>
      </ul>
      <p><strong>Don't lose your setup.</strong> Upgrade now to keep everything running.</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${baseUrl}/admin/billing" class="button" style="background: #dc2626;">Upgrade Now &mdash; Keep My Data</a>
      </div>
    </div>
  `);
}

// Day 15: Post-expiry win-back
export function getTrialExpiredEmailHtml(name: string, companyName: string): string {
  const baseUrl = getBaseUrl();
  return trialEmailShell("Your trial has expired", `
    <div class="header"><h1>Your trial has expired</h1></div>
    <div class="content">
      <p>Hi ${escapeHtml(name)},</p>
      <p>The free trial for <strong>${escapeHtml(companyName)}</strong> has ended. Your team no longer has access to PartsIQ.</p>
      <p><strong>But your data is safe.</strong> We'll keep everything &mdash; vehicles, suppliers, parts data, and settings &mdash; for 30 days. Subscribe anytime to pick up right where you left off.</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${baseUrl}/admin/billing" class="button">Reactivate My Account</a>
      </div>
      <p style="font-size: 14px; color: #64748b;">If you have any feedback about why PartsIQ wasn't the right fit, we'd love to hear it. Just reply to this email.</p>
    </div>
  `);
}
