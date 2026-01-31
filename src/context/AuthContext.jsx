import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { accountService } from '../services/accountService';
import { walletService } from '../services/walletService';
import { keycloakService } from '../services/keycloakService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [transactionVersion, setTransactionVersion] = useState(0); // Increments when transactions change

  // Check for existing session on mount - TOKEN BASED AUTH
  useEffect(() => {
    const loadUser = async () => {
      // ✅ STEP 1: Check for valid access token FIRST (Keycloak or legacy)
      const hasValidToken = keycloakService.isAuthenticated() || authService.hasValidToken();

      if (!hasValidToken) {
        // No valid token - user must login
        console.log('[Auth] No valid token found');
        // Clear any stale user data
        localStorage.removeItem('user');
        localStorage.removeItem('accountId');
        setLoading(false);
        return;
      }

      console.log('[Auth] Valid token found, restoring session');

      // ✅ STEP 2: Token is valid, restore user data
      const storedUser = localStorage.getItem('user');
      const storedAccountId = localStorage.getItem('accountId');

      if (storedUser && storedAccountId) {
        try {
          const userData = JSON.parse(storedUser);
          // Refresh balance from external API
          const balanceResult = await walletService.getBalance(storedAccountId);
          if (balanceResult.success) {
            userData.balance = balanceResult.balance;
            localStorage.setItem('user', JSON.stringify(userData));
          }
          setUser(userData);
          setIsAuthenticated(true);
          setLoading(false);
          return;
        } catch (e) {
          console.error('[Auth] Error loading stored user:', e);
        }
      }

      // Token exists but no user data - try to get from legacy storage
      const result = await authService.getCurrentUser();
      if (result.success && result.data) {
        setUser(result.data.user);
        setIsAuthenticated(true);
      } else {
        // Token exists but can't get user - clear token
        console.log('[Auth] Token exists but no user data - clearing');
        authService.clearAuthToken();
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  // Periodic balance refresh when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshBalance = async () => {
      const storedAccountId = localStorage.getItem('accountId');
      if (storedAccountId) {
        try {
          const balanceResult = await walletService.getBalance(storedAccountId);
          if (balanceResult.success) {
            setUser(prev => {
              if (!prev) return prev;
              // Always update if balance changed
              if (prev.balance !== balanceResult.balance) {
                const updated = { ...prev, balance: balanceResult.balance, availableBalance: balanceResult.balance };
                localStorage.setItem('user', JSON.stringify(updated));
                return updated;
              }
              return prev;
            });
          }
        } catch (e) {
          // Silently fail - will retry on next interval
        }
      }
    };

    // Check localStorage for updates from admin panel
    const checkLocalStorage = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setUser(prev => {
            if (!prev) return prev;
            // Update if balance is different
            if (prev.balance !== userData.balance) {
              return { ...prev, balance: userData.balance, availableBalance: userData.balance };
            }
            return prev;
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    };

    // Listen for storage events from other tabs
    const handleStorageChange = (e) => {
      if (e.key === 'user' && e.newValue) {
        try {
          const userData = JSON.parse(e.newValue);
          setUser(prev => {
            if (!prev) return prev;
            if (prev.balance !== userData.balance) {
              return { ...prev, balance: userData.balance, availableBalance: userData.balance };
            }
            return prev;
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Check localStorage every 1 second for instant updates (same tab)
    const localStorageInterval = setInterval(checkLocalStorage, 1000);
    // Refresh from API every 10 seconds (more frequent for better UX)
    const apiInterval = setInterval(refreshBalance, 10000);
    // Also refresh immediately
    refreshBalance();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(localStorageInterval);
      clearInterval(apiInterval);
    };
  }, [isAuthenticated]);

  // Login - handles credentials and saves access token
  const login = useCallback(async (usernameOrCredentials, password) => {
    // Handle object format (phone/password or email/password login)
    if (typeof usernameOrCredentials === 'object') {
      const { username, email, phone, password: pwd, accessToken, _userData } = usernameOrCredentials;

      // ✅ If accessToken is provided (from signup/login response), save it
      if (accessToken) {
        authService.setAuthToken(accessToken);
        console.log('[Auth] Access token saved');
      }

      // ✅ If userData is provided directly (after OTP verification), use it
      if (_userData) {
        // Still require token for security
        if (!authService.hasValidToken()) {
          console.warn('[Auth] Login with _userData but no valid token');
        }
        setUser(_userData);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(_userData));
        if (_userData.accountId) localStorage.setItem('accountId', _userData.accountId);
        return { success: true, data: { user: _userData } };
      }

      const loginIdentifier = phone || email || username;

      // Try phone-based login first
      if (loginIdentifier && (loginIdentifier.startsWith('+') || /^\d/.test(loginIdentifier))) {
        const phoneResult = await accountService.loginWithPhone(loginIdentifier, pwd);
        if (phoneResult.success) {
          const account = phoneResult.account;

          // ✅ Save token if returned from backend
          if (phoneResult.accessToken) {
            authService.setAuthToken(phoneResult.accessToken);
          }

          const balanceResult = await walletService.getBalance(account.accountId);

          const userData = {
            accountId: account.accountId,
            userId: account.userId,
            walletId: balanceResult.walletId,
            firstName: account.firstName,
            lastName: account.lastName,
            fullName: `${account.firstName} ${account.lastName}`,
            phone: account.phoneNumber,
            balance: balanceResult.success ? balanceResult.balance : 0,
            status: account.status,
            isLocal: account.isLocal,
          };

          localStorage.setItem('user', JSON.stringify(userData));
          localStorage.setItem('accountId', account.accountId);
          if (account.userId) localStorage.setItem('userId', account.userId);
          if (balanceResult.walletId) localStorage.setItem('walletId', balanceResult.walletId);

          setUser(userData);
          setIsAuthenticated(true);
          return { success: true, data: { user: userData } };
        }
      }

      // Try to get account from external API by email
      const accountResult = await accountService.getAccountByEmail(loginIdentifier);
      if (accountResult.success) {
        const account = accountResult.account;

        // ✅ Save token if returned
        if (accountResult.accessToken) {
          authService.setAuthToken(accountResult.accessToken);
        }

        const balanceResult = await walletService.getBalance(account.accountId);

        const userData = {
          accountId: account.accountId,
          email: account.email,
          firstName: account.firstName,
          lastName: account.lastName,
          fullName: `${account.firstName} ${account.lastName}`,
          phone: account.phoneNumber,
          balance: balanceResult.success ? balanceResult.balance : 0,
          status: account.status,
        };

        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('accountId', account.accountId);

        setUser(userData);
        setIsAuthenticated(true);
        return { success: true, data: { user: userData } };
      }

      // Fall back to demo/legacy auth with the provided credentials
      const demoResult = await authService.login(loginIdentifier, pwd);
      if (demoResult.success) {
        if (demoResult.accessToken) {
          authService.setAuthToken(demoResult.accessToken);
        }
        setUser(demoResult.data.user);
        setIsAuthenticated(true);
      }
      return demoResult;
    }

    // Handle old format: login(username, password)
    const result = await authService.login(usernameOrCredentials, password);
    if (result.success) {
      if (result.accessToken) {
        authService.setAuthToken(result.accessToken);
      }
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
    // Clear Keycloak tokens
    keycloakService.logout();
    // Clear external API data
    localStorage.removeItem('user');
    localStorage.removeItem('accountId');
    localStorage.removeItem('userId');
    localStorage.removeItem('walletId');
    // Clear legacy auth data
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const updateProfile = useCallback(async (updates) => {
    // Check if using external API
    const storedAccountId = localStorage.getItem('accountId');
    if (storedAccountId) {
      const result = await accountService.updateAccount(storedAccountId, updates);
      if (result.success) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          const updatedUser = { ...userData, ...updates };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setUser(updatedUser);
        }
      }
      return result;
    }

    // Fall back to legacy auth
    const result = await authService.updateProfile(updates);
    if (result.success) {
      setUser(result.data);
    }
    return result;
  }, []);

  const updateBalance = useCallback((newBalance) => {
    setUser(prev => {
      if (!prev) return null;

      const updatedUser = typeof newBalance === 'object'
        ? {
            ...prev,
            balance: newBalance.total ?? newBalance.balance ?? newBalance,
            availableBalance: newBalance.available ?? newBalance.total ?? newBalance,
            pendingBalance: newBalance.pending ?? 0
          }
        : { ...prev, balance: newBalance, availableBalance: newBalance };

      // Sync with localStorage for external API users
      const storedAccountId = localStorage.getItem('accountId');
      if (storedAccountId) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      return updatedUser;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    // First check for external API user
    const storedAccountId = localStorage.getItem('accountId');
    if (storedAccountId) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          // Refresh balance from external API
          const balanceResult = await walletService.getBalance(storedAccountId);
          if (balanceResult.success) {
            userData.balance = balanceResult.balance;
            localStorage.setItem('user', JSON.stringify(userData));
          }
          setUser(userData);
          return;
        } catch (e) {
          console.error('Error refreshing user:', e);
        }
      }
    }

    // Fall back to legacy auth
    const result = await authService.getCurrentUser();
    if (result.success && result.data) {
      setUser(result.data.user);
    }
  }, []);

  // Notify that a transaction occurred (deposit, withdraw, win, loss)
  const notifyTransactionUpdate = useCallback(() => {
    setTransactionVersion(v => v + 1);
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
    refreshUser,
    transactionVersion,
    notifyTransactionUpdate
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
