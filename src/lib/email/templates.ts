import {EmailTemplate} from './types';

export const emailTemplates = {
    /**
     * Email verification template
     */
    emailVerification: (data: { userName?: string; verificationUrl: string; companyName?: string }): EmailTemplate => ({
        subject: 'Verify your email address - Accounted App',
        htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
          .footer { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; color: #6c757d; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .button:hover { background: #0056b3; }
          .code { background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 16px; letter-spacing: 2px; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #007bff;">Accounted App</h1>
            <p style="margin: 5px 0 0 0; color: #6c757d;">Enterprise Accounting System</p>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Hello${data.userName ? ` ${data.userName}` : ''},</p>
            <p>Thank you for registering with Accounted App. To complete your account setup and ensure security, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 14px;">
              ${data.verificationUrl}
            </p>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>This verification link will expire in 24 hours</li>
              <li>You won't be able to sign in until your email is verified</li>
              <li>If you didn't create this account, please ignore this email</li>
            </ul>
            
            <p>If you have any questions, please contact our support team.</p>
            
            <p>Best regards,<br>The Accounted App Team</p>
          </div>
          <div class="footer">
            <p>This email was sent to verify your account. If you didn't request this, please ignore it.</p>
            <p>© ${new Date().getFullYear()} Accounted App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
        textContent: `
      Verify Your Email Address - Accounted App
      
      Hello${data.userName ? ` ${data.userName}` : ''},
      
      Thank you for registering with Accounted App. To complete your account setup, please verify your email address by visiting this link:
      
      ${data.verificationUrl}
      
      Important notes:
      - This verification link will expire in 24 hours
      - You won't be able to sign in until your email is verified
      - If you didn't create this account, please ignore this email
      
      If you have any questions, please contact our support team.
      
      Best regards,
      The Accounted App Team
      
      © ${new Date().getFullYear()} Accounted App. All rights reserved.
    `
    }),

    /**
     * Password reset template
     */
    passwordReset: (data: { userName?: string; resetUrl: string }): EmailTemplate => ({
        subject: 'Reset your password - Accounted App',
        htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
          .footer { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; color: #6c757d; }
          .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .button:hover { background: #c82333; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #007bff;">Accounted App</h1>
            <p style="margin: 5px 0 0 0; color: #6c757d;">Enterprise Accounting System</p>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>Hello${data.userName ? ` ${data.userName}` : ''},</p>
            <p>We received a request to reset your password for your Accounted App account. If you made this request, click the button below to set a new password:</p>
            
            <div style="text-align: center;">
              <a href="${data.resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 14px;">
              ${data.resetUrl}
            </p>
            
            <div class="warning">
              <strong>Security Notice:</strong>
              <ul style="margin: 10px 0 0 0;">
                <li>This password reset link will expire in 1 hour</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password will remain unchanged until you create a new one</li>
                <li>For security, consider using a strong, unique password</li>
              </ul>
            </div>
            
            <p>If you continue to have trouble accessing your account, please contact our support team.</p>
            
            <p>Best regards,<br>The Accounted App Team</p>
          </div>
          <div class="footer">
            <p>This email was sent because a password reset was requested. If you didn't request this, please ignore it.</p>
            <p>© ${new Date().getFullYear()} Accounted App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
        textContent: `
      Reset Your Password - Accounted App
      
      Hello${data.userName ? ` ${data.userName}` : ''},
      
      We received a request to reset your password for your Accounted App account. If you made this request, please visit this link to set a new password:
      
      ${data.resetUrl}
      
      Security Notice:
      - This password reset link will expire in 1 hour
      - If you didn't request this reset, please ignore this email
      - Your password will remain unchanged until you create a new one
      - For security, consider using a strong, unique password
      
      If you continue to have trouble accessing your account, please contact our support team.
      
      Best regards,
      The Accounted App Team
      
      © ${new Date().getFullYear()} Accounted App. All rights reserved.
    `
    }),

    /**
     * Welcome email template (optional - for after email verification)
     */
    welcome: (data: { userName?: string; organizationName?: string }): EmailTemplate => ({
        subject: 'Welcome to Accounted App - Get Started with Your Accounting System',
        htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Accounted App</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #007bff, #0056b3); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; color: white; }
          .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
          .footer { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; color: #6c757d; }
          .feature { background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #007bff; }
          .cta-button { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Welcome to Accounted App!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your enterprise accounting system is ready</p>
          </div>
          <div class="content">
            <h2>Hello${data.userName ? ` ${data.userName}` : ''}! 🎉</h2>
            <p>Congratulations! Your email has been verified and your Accounted App account is now active${data.organizationName ? ` for ${data.organizationName}` : ''}.</p>
            
            <p>You now have access to a comprehensive enterprise accounting system with:</p>
            
            <div class="feature">
              <h3 style="margin-top: 0;">📊 Multi-Currency Support</h3>
              <p>Handle international transactions with automatic exchange rate management and revaluation.</p>
            </div>
            
            <div class="feature">
              <h3 style="margin-top: 0;">🔒 Enterprise Security</h3>
              <p>Bank-grade security with role-based access control, audit trails, and immutable journal entries.</p>
            </div>
            
            <div class="feature">
              <h3 style="margin-top: 0;">🏢 Multi-Tenant Architecture</h3>
              <p>Complete organization isolation with advanced permission management.</p>
            </div>
            
            <div class="feature">
              <h3 style="margin-top: 0;">📈 Financial Reporting</h3>
              <p>Generate balance sheets, P&L statements, and compliance reports with ease.</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:8888'}/auth/login" class="cta-button">
                Sign In to Your Account
              </a>
            </div>
            
            <p>Need help getting started? Check out our documentation or contact our support team.</p>
            
            <p>Welcome aboard!<br>The Accounted App Team</p>
          </div>
          <div class="footer">
            <p>You're receiving this email because you successfully created an Accounted App account.</p>
            <p>© ${new Date().getFullYear()} Accounted App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
        textContent: `
      Welcome to Accounted App!
      
      Hello${data.userName ? ` ${data.userName}` : ''}!
      
      Congratulations! Your email has been verified and your Accounted App account is now active${data.organizationName ? ` for ${data.organizationName}` : ''}.
      
      You now have access to a comprehensive enterprise accounting system with:
      
      📊 Multi-Currency Support
      Handle international transactions with automatic exchange rate management.
      
      🔒 Enterprise Security
      Bank-grade security with role-based access control and audit trails.
      
      🏢 Multi-Tenant Architecture
      Complete organization isolation with advanced permission management.
      
      📈 Financial Reporting
      Generate balance sheets, P&L statements, and compliance reports.
      
      Sign in to your account: ${process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:8888'}/auth/login
      
      Need help getting started? Check out our documentation or contact our support team.
      
      Welcome aboard!
      The Accounted App Team
      
      © ${new Date().getFullYear()} Accounted App. All rights reserved.
    `
    })
};