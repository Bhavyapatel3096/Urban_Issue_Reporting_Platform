const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Email templates
const templates = {
  welcome: (data) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background: linear-gradient(135deg, #1a5276 0%, #2980b9 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Anand Municipal Corporation</h1>
        <p style="color: #e8f4fd; margin: 10px 0 0 0; font-size: 16px;">Your Civic Engagement Platform</p>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Hello ${data.firstName}!</h2>
        
        <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
          Thank you for joining our municipal platform. You can now report issues, track their progress, and contribute to making Anand a better place to live.
        </p>
        
        <div style="background: #f1f8ff; padding: 20px; border-radius: 8px; border-left: 4px solid #2980b9; margin: 20px 0;">
          <h3 style="color: #1a5276; margin-top: 0;">What you can do:</h3>
          <ul style="color: #555; line-height: 1.6;">
            <li>Report municipal issues with photos and location</li>
            <li>Track the status of your reported issues</li>
            <li>Receive notifications about updates</li>
            <li>Contribute to community discussions</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/verify-email?token=${data.verificationToken}" 
             style="background: #2980b9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        
        <p style="color: #777; font-size: 14px; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
          If you have any questions, please contact us at info@anandmc.gov.in<br>
          © 2025 Anand Municipal Corporation. All rights reserved.
        </p>
      </div>
    </div>
  `,

  'password-reset': (data) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset Request</h1>
        <p style="color: #fadbd8; margin: 10px 0 0 0; font-size: 16px;">Anand Municipal Corporation</p>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Hello ${data.firstName}!</h2>
        
        <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
          We received a request to reset your password for your Anand Municipal Corporation account.
        </p>
        
        <div style="background: #fef9e7; padding: 20px; border-radius: 8px; border-left: 4px solid #f39c12; margin: 20px 0;">
          <p style="color: #d35400; margin: 0; font-weight: bold;">
            ⚠️ This link will expire in 10 minutes for security reasons.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetUrl}" 
             style="background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
          If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
        </p>
        
        <p style="color: #777; font-size: 14px; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
          If you have any questions, please contact us at info@anandmc.gov.in<br>
          © 2025 Anand Municipal Corporation. All rights reserved.
        </p>
      </div>
    </div>
  `,

  'issue-update': (data) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background: linear-gradient(135deg, #27ae60 0%, #229954 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Issue Update</h1>
        <p style="color: #d5f4e6; margin: 10px 0 0 0; font-size: 16px;">Anand Municipal Corporation</p>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Hello ${data.userName}!</h2>
        
        <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
          There's an update on your reported issue:
        </p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
          <h3 style="color: #1e8449; margin-top: 0;">${data.issueTitle}</h3>
          <p style="color: #555; margin: 10px 0;"><strong>Status:</strong> <span style="color: #27ae60;">${data.newStatus}</span></p>
          <p style="color: #555; margin: 10px 0;"><strong>Tracking ID:</strong> ${data.trackingId}</p>
          ${data.notes ? `<p style="color: #555; margin: 10px 0;"><strong>Notes:</strong> ${data.notes}</p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/issues/${data.issueId}" 
             style="background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            View Issue Details
          </a>
        </div>
        
        <p style="color: #777; font-size: 14px; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
          Thank you for helping us improve Anand!<br>
          © 2025 Anand Municipal Corporation. All rights reserved.
        </p>
      </div>
    </div>
  `
};

// Send email function
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    // Verify connection
    await transporter.verify();

    const { to, subject, template, data, html, text } = options;

    let emailHTML = html;
    let emailText = text;

    // Use template if provided
    if (template && templates[template]) {
      emailHTML = templates[template](data);
      emailText = `Please view this email in HTML format.`;
    }

    const mailOptions = {
      from: {
        name: 'Anand Municipal Corporation',
        address: process.env.EMAIL_FROM || process.env.EMAIL_USER
      },
      to,
      subject,
      html: emailHTML,
      text: emailText,
      // Add some security headers
      headers: {
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'X-Mailer': 'Anand Municipal Corporation System'
      }
    };

    const result = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', {
      to,
      subject,
      messageId: result.messageId
    });

    return result;

  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Send bulk emails
const sendBulkEmail = async (recipients, options) => {
  const results = [];
  const batchSize = 10; // Send in batches to avoid overwhelming the server

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    const batchPromises = batch.map(recipient => {
      const emailOptions = {
        ...options,
        to: recipient.email,
        data: { ...options.data, ...recipient }
      };
      
      return sendEmail(emailOptions).catch(error => ({
        email: recipient.email,
        error: error.message
      }));
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add a small delay between batches
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
};

// Validate email configuration
const validateEmailConfig = async () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('Email credentials not configured');
    }

    const transporter = createTransporter();
    await transporter.verify();
    
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error.message);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendBulkEmail,
  validateEmailConfig,
  templates
};
