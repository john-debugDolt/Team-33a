import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      const result = await authService.getCurrentUser();
      if (result.success && result.data) {
        setUser(result.data.user);
        setIsAuthenticated(true);
      }
      setLoading(false);
    };
    loadUser();
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
