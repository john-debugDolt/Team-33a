/**
 * OTP Service - Phone verification via SMS
 * Public API - No authentication required
 *
 * Endpoints:
 * - POST /api/otp/send - Send OTP to phone
 * - POST /api/otp/verify - Verify OTP code
 * - GET /api/otp/status/{phoneNumber} - Check verification status
 * - POST /api/otp/resend - Resend OTP
 */

const API_BASE = 'https://accounts.team33.mx';

// Format phone number to E.164 format (+61...)
const formatPhoneNumber = (phone, countryCode = '+61') => {
  if (!phone) return phone;
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    return countryCode + cleaned.substring(1);
  }
  if (cleaned.length > 10) {
    return '+' + cleaned;
  }
  return countryCode + cleaned;
};

class OTPService {
  /**
   * Send OTP to phone number
   * POST /api/otp/send
   */
  async sendOTP(phoneNumber) {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      const response = await fetch(`${API_BASE}/api/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: formattedPhone }),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (response.status === 429) {
        return {
          success: false,
          error: 'Too many requests. Please wait before trying again.',
          rateLimited: true,
        };
      }

      return {
        success: data.success,
        message: data.message,
        requestId: data.requestId,
        expiresInSeconds: data.expiresInSeconds || 300,
        maskedPhone: data.phoneNumber,
        error: data.success ? null : data.message,
      };
    } catch (error) {
      console.error('[OTPService] Send error:', error);
      return {
        success: false,
        error: 'Failed to send OTP. Please try again.',
      };
    }
  }

  /**
   * Verify OTP code
   * POST /api/otp/verify
   */
  async verifyOTP(phoneNumber, otp) {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      const response = await fetch(`${API_BASE}/api/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          otp: otp.toString(),
        }),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      return {
        success: data.success,
        verified: data.phoneVerified || false,
        message: data.message,
        remainingAttempts: data.remainingAttempts,
        error: data.success ? null : data.message,
      };
    } catch (error) {
      console.error('[OTPService] Verify error:', error);
      return {
        success: false,
        verified: false,
        error: 'Failed to verify OTP. Please try again.',
      };
    }
  }

  /**
   * Check verification status
   * GET /api/otp/status/{phoneNumber}
   */
  async checkStatus(phoneNumber) {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      const response = await fetch(
        `${API_BASE}/api/otp/status/${encodeURIComponent(formattedPhone)}`,
        { method: 'GET' }
      );

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      return { verified: data.verified || false };
    } catch (error) {
      console.error('[OTPService] Status error:', error);
      return { verified: false };
    }
  }

  /**
   * Resend OTP
   * POST /api/otp/resend
   */
  async resendOTP(phoneNumber) {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      const response = await fetch(`${API_BASE}/api/otp/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: formattedPhone }),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (response.status === 429) {
        return {
          success: false,
          error: 'Too many requests. Please wait before trying again.',
          rateLimited: true,
        };
      }

      return {
        success: data.success,
        message: data.message,
        expiresInSeconds: data.expiresInSeconds || 300,
        error: data.success ? null : data.message,
      };
    } catch (error) {
      console.error('[OTPService] Resend error:', error);
      return {
        success: false,
        error: 'Failed to resend OTP. Please try again.',
      };
    }
  }

  /**
   * Helper to format phone number (exposed for other services)
   */
  formatPhoneNumber(phone, countryCode = '+61') {
    return formatPhoneNumber(phone, countryCode);
  }
}

export const otpService = new OTPService();
export default otpService;
