import nodemailer from 'nodemailer';

// Initialize Gmail SMTP transporter using a Workspace mailbox app password.
// No DNS changes needed — Workspace already signs muzeoffice.com mail with SPF + DKIM.
const transporter = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  : null;

// Email configuration
const FROM_NAME = process.env.GMAIL_FROM_NAME || process.env.CAFE_NAME || 'Muze Cafe';
const FROM_ADDRESS = process.env.GMAIL_USER;
const FROM_EMAIL = FROM_ADDRESS ? `"${FROM_NAME}" <${FROM_ADDRESS}>` : null;
const CAFE_NAME = process.env.CAFE_NAME || 'Muze Office';

// Muze Office Brand Colors
const COLORS = {
  gold: '#F5B82E',      // Primary yellow/gold
  brown: '#A85A32',     // Terracotta brown
  cream: '#FFF8E7',     // Warm cream background
  dark: '#2D2014',      // Dark brown for text
  light: '#FFFDF8',     // Off-white
  warmGray: '#F5F0E8',  // Warm gray for sections
};

/**
 * Check if email service is configured
 */
export function isEmailConfigured() {
  return !!transporter;
}

/**
 * Format price as currency
 */
function formatPrice(price) {
  return `$${parseFloat(price).toFixed(2)}`;
}

/**
 * Format pickup number with leading zeros
 */
function formatPickupNumber(num) {
  return String(num).padStart(3, '0');
}

/**
 * Generate order confirmation email HTML - Muze Office Branded
 */
function generateConfirmationEmail(order) {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 14px 16px; border-bottom: 1px solid #E8E0D5;">
        <strong style="color: ${COLORS.dark};">${item.quantity}x ${item.item_name}</strong>
        ${item.modifiers ? `<br><span style="color: ${COLORS.brown}; font-size: 13px;">${item.modifiers}</span>` : ''}
        ${item.special_instructions ? `<br><span style="color: ${COLORS.gold}; font-size: 13px; font-style: italic;">Note: ${item.special_instructions}</span>` : ''}
      </td>
      <td style="padding: 14px 16px; border-bottom: 1px solid #E8E0D5; text-align: right; color: ${COLORS.dark}; font-weight: 500;">
        ${formatPrice(item.total_price)}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: ${COLORS.cream}; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: ${COLORS.light}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(45, 32, 20, 0.12);">

        <!-- Header with Logo Area -->
        <div style="background: linear-gradient(135deg, ${COLORS.dark} 0%, #3D2E1F 100%); padding: 40px 32px; text-align: center;">
          <div style="display: inline-block; background: ${COLORS.gold}; width: 60px; height: 60px; border-radius: 50%; margin-bottom: 16px; line-height: 60px;">
            <span style="font-size: 28px;">☕</span>
          </div>
          <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: ${COLORS.light}; letter-spacing: -0.5px;">${CAFE_NAME}</h1>
          <p style="margin: 0; color: ${COLORS.gold}; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Order Confirmed</p>
        </div>

        <!-- Pickup Number Banner -->
        <div style="background: linear-gradient(135deg, ${COLORS.gold} 0%, #E5A829 100%); padding: 28px; text-align: center;">
          <p style="margin: 0 0 8px 0; color: ${COLORS.dark}; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Your Pickup Number</p>
          <p style="margin: 0; font-size: 56px; font-weight: 800; color: ${COLORS.dark}; letter-spacing: -2px;">#${formatPickupNumber(order.pickup_number)}</p>
        </div>

        <!-- Greeting -->
        <div style="padding: 28px 32px 20px 32px;">
          <p style="margin: 0; color: ${COLORS.dark}; font-size: 16px; line-height: 1.6;">
            Hi <strong>${order.customer_name}</strong>,<br>
            Thank you for your order! We're preparing it with care.
          </p>
        </div>

        <!-- Order Items -->
        <div style="padding: 0 32px 24px 32px;">
          <table style="width: 100%; border-collapse: collapse; background: ${COLORS.warmGray}; border-radius: 12px; overflow: hidden;">
            <thead>
              <tr>
                <th style="padding: 14px 16px; text-align: left; background: ${COLORS.brown}; color: ${COLORS.light}; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Item</th>
                <th style="padding: 14px 16px; text-align: right; background: ${COLORS.brown}; color: ${COLORS.light}; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Price</th>
              </tr>
            </thead>
            <tbody style="background: ${COLORS.light};">
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div style="padding: 0 32px 32px 32px;">
          <div style="background: ${COLORS.warmGray}; border-radius: 12px; padding: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #6B5D4D; font-size: 14px;">Subtotal</td>
                <td style="padding: 6px 0; text-align: right; color: ${COLORS.dark};">${formatPrice(order.subtotal)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6B5D4D; font-size: 14px;">Tax</td>
                <td style="padding: 6px 0; text-align: right; color: ${COLORS.dark};">${formatPrice(order.tax)}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 12px 0 0 0;"><div style="border-top: 2px solid ${COLORS.gold};"></div></td>
              </tr>
              <tr>
                <td style="padding: 12px 0 0 0; color: ${COLORS.dark}; font-size: 18px; font-weight: 700;">Total</td>
                <td style="padding: 12px 0 0 0; text-align: right; color: ${COLORS.brown}; font-size: 20px; font-weight: 700;">${formatPrice(order.total)}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: ${COLORS.dark}; padding: 28px 32px; text-align: center;">
          <p style="margin: 0 0 8px 0; color: ${COLORS.gold}; font-size: 14px; font-weight: 500;">We'll notify you when your order is ready!</p>
          <p style="margin: 0; color: #8B7355; font-size: 12px;">Order placed ${new Date(order.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>

      </div>

      <!-- Bottom Branding -->
      <div style="text-align: center; padding: 24px;">
        <p style="margin: 0; color: ${COLORS.brown}; font-size: 12px;">Made with ☕ by ${CAFE_NAME}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate order ready email HTML - Muze Office Branded
 */
function generateReadyEmail(order) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: ${COLORS.cream}; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: ${COLORS.light}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(45, 32, 20, 0.12);">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${COLORS.brown} 0%, #8B4A2A 100%); padding: 40px 32px; text-align: center;">
          <div style="display: inline-block; background: ${COLORS.gold}; width: 70px; height: 70px; border-radius: 50%; margin-bottom: 16px; line-height: 70px;">
            <span style="font-size: 36px;">✓</span>
          </div>
          <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: ${COLORS.light}; letter-spacing: -0.5px;">${CAFE_NAME}</h1>
          <p style="margin: 0; color: ${COLORS.gold}; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Order Ready!</p>
        </div>

        <!-- Pickup Number - Large & Prominent -->
        <div style="background: linear-gradient(135deg, ${COLORS.gold} 0%, #E5A829 100%); padding: 40px; text-align: center;">
          <p style="margin: 0 0 12px 0; color: ${COLORS.dark}; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">Pickup Number</p>
          <p style="margin: 0; font-size: 72px; font-weight: 800; color: ${COLORS.dark}; letter-spacing: -3px; line-height: 1;">#${formatPickupNumber(order.pickup_number)}</p>
        </div>

        <!-- Message -->
        <div style="padding: 40px 32px; text-align: center;">
          <p style="margin: 0 0 16px 0; font-size: 22px; color: ${COLORS.dark}; font-weight: 600;">
            Hi ${order.customer_name}!
          </p>
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #6B5D4D; line-height: 1.7;">
            Great news! Your order is ready and waiting for you at the counter.
          </p>
          <div style="background: ${COLORS.warmGray}; border-radius: 12px; padding: 20px; border-left: 4px solid ${COLORS.gold};">
            <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px;">
              📍 Please show your pickup number when collecting your order
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: ${COLORS.dark}; padding: 28px 32px; text-align: center;">
          <p style="margin: 0 0 8px 0; color: ${COLORS.gold}; font-size: 16px; font-weight: 500;">Thank you for choosing us!</p>
          <p style="margin: 0; color: #8B7355; font-size: 12px;">We hope you enjoy your order ☕</p>
        </div>

      </div>

      <!-- Bottom Branding -->
      <div style="text-align: center; padding: 24px;">
        <p style="margin: 0; color: ${COLORS.brown}; font-size: 12px;">Made with ☕ by ${CAFE_NAME}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send order confirmation email
 * @param {Object} order - The order object with customer email
 * @returns {Promise<Object>} Result with success status
 */
export async function sendOrderConfirmation(order) {
  if (!transporter) {
    console.log('Email service not configured - skipping order confirmation email');
    return { success: false, reason: 'not_configured' };
  }

  if (!order.email) {
    console.log('No email address provided - skipping confirmation email');
    return { success: false, reason: 'no_email' };
  }

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: order.email,
      subject: `Order #${formatPickupNumber(order.pickup_number)} Confirmed ☕ ${CAFE_NAME}`,
      html: generateConfirmationEmail(order),
    });

    console.log(`Confirmation email sent to ${order.email} for order #${order.pickup_number}`);
    return { success: true, emailId: info.messageId };
  } catch (err) {
    console.error('Error sending confirmation email:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Generate order cancellation email HTML - Muze Office Branded
 */
function generateCancellationEmail(order) {
  const reasonLine = order.cancellation_reason
    ? `<p style="margin: 16px 0 0 0; font-size: 14px; color: #6B5D4D;">Reason on file: <em>${order.cancellation_reason}</em></p>`
    : '';
  const cancelledByLine = order.cancelled_by === 'staff'
    ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: ${COLORS.brown};">Cancelled by our team.</p>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: ${COLORS.cream}; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: ${COLORS.light}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(45, 32, 20, 0.12);">

        <div style="background: linear-gradient(135deg, ${COLORS.dark} 0%, #3D2E1F 100%); padding: 40px 32px; text-align: center;">
          <div style="display: inline-block; background: ${COLORS.gold}; width: 60px; height: 60px; border-radius: 50%; margin-bottom: 16px; line-height: 60px;">
            <span style="font-size: 28px;">×</span>
          </div>
          <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: ${COLORS.light}; letter-spacing: -0.5px;">${CAFE_NAME}</h1>
          <p style="margin: 0; color: ${COLORS.gold}; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Order Cancelled</p>
        </div>

        <div style="padding: 40px 32px; text-align: center;">
          <p style="margin: 0 0 16px 0; font-size: 22px; color: ${COLORS.dark}; font-weight: 600;">Hi ${order.customer_name},</p>
          <p style="margin: 0; font-size: 16px; color: #6B5D4D; line-height: 1.7;">
            Order <strong>#${formatPickupNumber(order.pickup_number)}</strong> has been cancelled. You won't be charged.
          </p>
          ${cancelledByLine}
          ${reasonLine}
          <p style="margin: 28px 0 0 0; font-size: 14px; color: #6B5D4D; line-height: 1.7;">
            Place a new order anytime — we'll be right here.
          </p>
        </div>

        <div style="background: ${COLORS.dark}; padding: 24px 32px; text-align: center;">
          <p style="margin: 0; color: ${COLORS.gold}; font-size: 14px;">See you next time ☕</p>
        </div>
      </div>

      <div style="text-align: center; padding: 24px;">
        <p style="margin: 0; color: ${COLORS.brown}; font-size: 12px;">Made with ☕ by ${CAFE_NAME}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate pickup-reminder email HTML - Muze Office Branded
 */
function generatePickupReminderEmail(order) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: ${COLORS.cream}; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: ${COLORS.light}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(45, 32, 20, 0.12);">

        <div style="background: linear-gradient(135deg, ${COLORS.brown} 0%, #8B4A2A 100%); padding: 36px 32px; text-align: center;">
          <div style="display: inline-block; background: ${COLORS.gold}; width: 70px; height: 70px; border-radius: 50%; margin-bottom: 16px; line-height: 70px;">
            <span style="font-size: 32px;">⏰</span>
          </div>
          <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: ${COLORS.light}; letter-spacing: -0.5px;">${CAFE_NAME}</h1>
          <p style="margin: 0; color: ${COLORS.gold}; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Friendly reminder</p>
        </div>

        <div style="background: linear-gradient(135deg, ${COLORS.gold} 0%, #E5A829 100%); padding: 36px; text-align: center;">
          <p style="margin: 0 0 10px 0; color: ${COLORS.dark}; font-size: 13px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">Pickup Number</p>
          <p style="margin: 0; font-size: 64px; font-weight: 800; color: ${COLORS.dark}; letter-spacing: -2px; line-height: 1;">#${formatPickupNumber(order.pickup_number)}</p>
        </div>

        <div style="padding: 36px 32px; text-align: center;">
          <p style="margin: 0 0 14px 0; font-size: 20px; color: ${COLORS.dark}; font-weight: 600;">Hi ${order.customer_name},</p>
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #6B5D4D; line-height: 1.7;">
            Your order's been waiting at the counter for a few minutes — swing by whenever you're ready!
          </p>
          <div style="background: ${COLORS.warmGray}; border-radius: 12px; padding: 18px; border-left: 4px solid ${COLORS.gold};">
            <p style="margin: 0; color: ${COLORS.dark}; font-size: 14px;">📍 Show your pickup number at the counter</p>
          </div>
        </div>

        <div style="background: ${COLORS.dark}; padding: 24px 32px; text-align: center;">
          <p style="margin: 0; color: ${COLORS.gold}; font-size: 14px;">Enjoy ☕</p>
        </div>
      </div>

      <div style="text-align: center; padding: 24px;">
        <p style="margin: 0; color: ${COLORS.brown}; font-size: 12px;">Made with ☕ by ${CAFE_NAME}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send order ready notification email
 * @param {Object} order - The order object with customer email
 * @returns {Promise<Object>} Result with success status
 */
export async function sendOrderReadyNotification(order) {
  if (!transporter) {
    console.log('Email service not configured - skipping ready notification email');
    return { success: false, reason: 'not_configured' };
  }

  if (!order.email) {
    console.log('No email address for order - skipping ready notification');
    return { success: false, reason: 'no_email' };
  }

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: order.email,
      subject: `Your Order #${formatPickupNumber(order.pickup_number)} is Ready! 🎉 ${CAFE_NAME}`,
      html: generateReadyEmail(order),
    });

    console.log(`Ready notification email sent to ${order.email} for order #${order.pickup_number}`);
    return { success: true, emailId: info.messageId };
  } catch (err) {
    console.error('Error sending ready notification email:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send order cancellation email
 * @param {Object} order - The order object with customer email
 * @returns {Promise<Object>} Result with success status
 */
export async function sendOrderCancellation(order) {
  if (!transporter) {
    console.log('Email service not configured - skipping cancellation email');
    return { success: false, reason: 'not_configured' };
  }
  if (!order.email) {
    console.log('No email address for order - skipping cancellation email');
    return { success: false, reason: 'no_email' };
  }
  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: order.email,
      subject: `Order #${formatPickupNumber(order.pickup_number)} cancelled · ${CAFE_NAME}`,
      html: generateCancellationEmail(order),
    });
    console.log(`Cancellation email sent to ${order.email} for order #${order.pickup_number}`);
    return { success: true, emailId: info.messageId };
  } catch (err) {
    console.error('Error sending cancellation email:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send pickup reminder email (fired ~10 min after status flips to 'ready')
 * @param {Object} order - The order object with customer email
 * @returns {Promise<Object>} Result with success status
 */
export async function sendPickupReminder(order) {
  if (!transporter) {
    console.log('Email service not configured - skipping pickup reminder');
    return { success: false, reason: 'not_configured' };
  }
  if (!order.email) {
    console.log('No email address for order - skipping pickup reminder');
    return { success: false, reason: 'no_email' };
  }
  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: order.email,
      subject: `Your order #${formatPickupNumber(order.pickup_number)} is waiting ☕`,
      html: generatePickupReminderEmail(order),
    });
    console.log(`Pickup reminder email sent to ${order.email} for order #${order.pickup_number}`);
    return { success: true, emailId: info.messageId };
  } catch (err) {
    console.error('Error sending pickup reminder email:', err);
    return { success: false, error: err.message };
  }
}
