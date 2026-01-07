import { apiClient } from './api';

export const walletService = {
  async getBalance() {
    return await apiClient.get('/wallet/balance');
  },

  async getTransactions({ page = 1, limit = 10, type = 'all', status = 'all' } = {}) {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', limit);

    if (type && type !== 'all') {
      params.append('type', type);
    }

    if (status && status !== 'all') {
      params.append('status', status);
    }

    return await apiClient.get(`/wallet/transactions?${params.toString()}`);
  },

  async deposit(amount, paymentMethod = 'Credit Card') {
    const response = await apiClient.post('/wallet/deposit', { amount: Number(amount), paymentMethod });

    // Normalize response for wallet page
    if (response.success && response.data) {
      response.data.newBalance = response.data.balance?.total || response.data.balance;
    }

    return response;
  },

  async withdraw(amount, paymentMethod = 'Bank Transfer') {
    const response = await apiClient.post('/wallet/withdraw', { amount: Number(amount), paymentMethod });

    // Normalize response for wallet page
    if (response.success && response.data) {
      response.data.newBalance = response.data.balance?.available || response.data.balance;
    }

    return response;
  },

  async getCheckInStatus() {
    const response = await apiClient.get('/wallet/checkin');

    // Normalize response for wallet page
    if (response.success && response.data) {
      response.data.canCheckIn = !response.data.isCheckedToday;
    }

    return response;
  },

  async checkIn() {
    const response = await apiClient.post('/wallet/checkin', {});

    // Normalize response for wallet page
    if (response.success && response.data) {
      response.data.newBalance = response.data.balance?.total || response.data.balance;
      response.data.canCheckIn = false;
    }

    return response;
  },

  // Alias for backwards compatibility
  async dailyCheckIn() {
    return this.checkIn();
  },

  async transfer(amount, recipientUsername) {
    const response = await apiClient.post('/wallet/transfer', {
      amount: Number(amount),
      recipientUsername
    });

    // Normalize response for wallet page
    if (response.success && response.data) {
      response.data.newBalance = response.data.balance?.total || response.data.balance;
    }

    return response;
  }
};

export default walletService;
