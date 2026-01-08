import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

// Mock user for development - remove in production
const MOCK_USER = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  phone: '0812345678',
  balance: 5000,
  availableBalance: 5000,
  pendingBalance: 0,
  vipLevel: 'Gold',
  createdAt: '2024-01-01'
};

export function AuthProvider({ children }) {
  // Start with mock user for development
  const [user, setUser] = useState(MOCK_USER);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  // Skip auth check for development - uncomment below for production
  useEffect(() => {
    // For dev: just use mock user
    setUser(MOCK_USER);
    setIsAuthenticated(true);
    setLoading(false);

    // For production: uncomment this block
    // const loadUser = async () => {
    //   const result = await authService.getCurrentUser();
    //   if (result.success && result.data) {
    //     setUser(result.data.user);
    //     setIsAuthenticated(true);
    //   }
    //   setLoading(false);
    // };
    // loadUser();
  }, []);

  const login = useCallback(async (username, password) => {
    const result = await authService.login(username, password);
    if (result.success) {
      setUser(result.data.user);
      setIsAuthenticated(true);
    }
    return result;
  }, []);

  const signup = useCallback(async (userData) => {
    const result = await authService.signup(userData);
    if (result.success) {
      setUser(result.data.user);
      setIsAuthenticated(true);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const updateProfile = useCallback(async (updates) => {
    const result = await authService.updateProfile(updates);
    if (result.success) {
      setUser(result.data);
    }
    return result;
  }, []);

  const updateBalance = useCallback((newBalance) => {
    if (typeof newBalance === 'object') {
      // Handle balance object from API { total, available, pending }
      setUser(prev => prev ? {
        ...prev,
        balance: newBalance.total ?? newBalance,
        availableBalance: newBalance.available ?? newBalance.total ?? newBalance,
        pendingBalance: newBalance.pending ?? 0
      } : null);
    } else {
      // Handle simple number
      setUser(prev => prev ? { ...prev, balance: newBalance, availableBalance: newBalance } : null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const result = await authService.getCurrentUser();
    if (result.success && result.data) {
      setUser(result.data.user);
    }
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    signup,
    logout,
    updateProfile,
    updateBalance,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
