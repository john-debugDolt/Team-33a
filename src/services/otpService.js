// OTP Service - Phone verification via SMS
const OTP_API_BASE = '/api/otp';
const API_KEY = 'team33-admin-secret-key-change-in-prod';

// Dev bypass - use code "000000" to skip OTP
const DEV_BYPASS_CODE = '000000';
const BYPASS_ENABLED = false; // Set to true for dev bypass with code "000000"

class OTPService {
  constructor() {
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    };
  }

  // Format phone number to E.164 format
  formatPhoneNumber(phone, countryCode = '+61') {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, remove it (Australian format)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // If already has country code digits, use as is
    if (cleaned.length > 10) {
      return '+' + cleaned;
    }

    // Add country code
    return countryCode + cleaned;
  }

  // Send OTP to phone number
  async sendOTP(phoneNumber) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    // Dev bypass - simulate successful OTP send
    if (BYPASS_ENABLED) {
      console.log('[DEV] OTP send simulated for:', formattedPhone);
      console.log('[DEV] Use code "000000" to verify');
      return {
        success: true,
        message: 'Dev mode - use code 000000',
        requestId: 'dev-bypass',
        expiresInSeconds: 300,
        maskedPhone: formattedPhone.replace(/(\+\d{2})\d{6}(\d{4})/, '$1******$2'),
      };
    }

    try {
      const response = await fetch(`${OTP_API_BASE}/send`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ phoneNumber: formattedPhone }),
      });

      const data = await response.json();

      if (response.status === 429) {
        return {
          success: false,
          error: 'Too many OTP requests. Please try again later.',
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
      console.error('OTP send error:', error);
      return {
        success: false,
        error: 'Failed to send OTP. Please check your connection.',
      };
    }
  }

  // Verify OTP code
  async verifyOTP(phoneNumber, otp) {
    // Dev bypass - use "000000" to skip verification
    if (BYPASS_ENABLED && otp === DEV_BYPASS_CODE) {
      console.log('[DEV] OTP bypass activated');
      return {
        success: true,
        verified: true,
        message: 'Dev bypass - phone verified',
      };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const response = await fetch(`${OTP_API_BASE}/verify`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          otp: otp.toString(),
        }),
      });

      const data = await response.json();

      return {
        success: data.success,
        verified: data.phoneVerified || false,
        message: data.message,
        remainingAttempts: data.remainingAttempts,
        error: data.success ? null : data.message,
      };
    } catch (error) {
      console.error('OTP verify error:', error);
      return {
        success: false,
        verified: false,
        error: 'Failed to verify OTP. Please try again.',
      };
    }
  }

  // Check verification status
  async checkStatus(phoneNumber) {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const encodedPhone = encodeURIComponent(formattedPhone);

      const response = await fetch(`${OTP_API_BASE}/status/${encodedPhone}`, {
        method: 'GET',
        headers: this.headers,
      });

      const data = await response.json();

      return {
        verified: data.verified || false,
      };
    } catch (error) {
      console.error('OTP status check error:', error);
      return { verified: false };
    }
  }

  // Resend OTP
  async resendOTP(phoneNumber) {
    // Dev bypass - simulate successful resend
    if (BYPASS_ENABLED) {
      console.log('[DEV] OTP resend simulated');
      return {
        success: true,
        message: 'Dev mode - use code 000000',
        expiresInSeconds: 300,
      };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const response = await fetch(`${OTP_API_BASE}/resend`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ phoneNumber: formattedPhone }),
      });

      const data = await response.json();

      if (response.status === 429) {
        return {
          success: false,
          error: 'Too many OTP requests. Please try again later.',
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
      console.error('OTP resend error:', error);
      return {
        success: false,
        error: 'Failed to resend OTP. Please try again.',
      };
    }
  }
}

export const otpService = new OTPService();
