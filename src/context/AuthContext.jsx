import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services/authService';
import { accountService } from '../services/accountService';
import { walletService } from '../services/walletService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [transactionVersion, setTransactionVersion] = useState(0); // Increments when transactions change

  // Balance freeze: hold the displayed balance constant for a short window so
  // a player launching a game doesn't see the deposit debit (5s freeze on
  // launch) and a player closing one doesn't see a transient 0 before the
  // sweep credits back (4s freeze on close at the pre-launch value). All
  // four balance-update paths (refreshBalance, checkLocalStorage, storage
  // event, updateBalance) check this ref and skip while it's active.
  const balanceFreezeRef = useRef(null); // { expiresAt: number } | null

  const isBalanceFrozen = useCallback(() => {
    const f = balanceFreezeRef.current;
    if (!f) return false;
    if (Date.now() >= f.expiresAt) {
      balanceFreezeRef.current = null;
      return false;
    }
    return true;
  }, []);

  const freezeBalance = useCallback((value, durationMs) => {
    // Snap the displayed value first, then lock further updates for the window.
    const num = Number(value);
    if (Number.isFinite(num)) {
      setUser(prev => prev ? { ...prev, balance: num, availableBalance: num } : prev);
    }
    balanceFreezeRef.current = { expiresAt: Date.now() + Math.max(0, Number(durationMs) || 0) };
  }, []);

  // Auto-recovery for "balance reads 0 but a launch is still on the LIFO
  // stack" — almost always means a transfer-wallet provider holds funds we
  // need to /exit to recover. The watcher fires recoverLastLaunch (which
  // pops the LIFO top and posts /exit), freezes the display at the entry's
  // preLaunchBalance for 4s, and blocks new launches until the recovery
  // settles. Capped at 3 attempts and cool-offed 5s between to avoid
  // hammering when the bank really is empty.
  const recoveryRef = useRef({ attempts: 0, lastAttemptAt: 0, active: false });
  const launchBlockedRef = useRef(false);

  const isLaunchBlocked = useCallback(() => launchBlockedRef.current, []);

  const maybeAutoRecover = useCallback(async (currentBalance) => {
    if (currentBalance > 0) {
      // Healthy balance — reset the attempt counter so a future zero gets
      // the full three retries.
      recoveryRef.current = { attempts: 0, lastAttemptAt: 0, active: false };
      launchBlockedRef.current = false;
      return;
    }
    if (recoveryRef.current.active) return;
    if (recoveryRef.current.attempts >= 3) return;
    const now = Date.now();
    if (now - recoveryRef.current.lastAttemptAt < 5000) return;

    let top, pre;
    try {
      const tracker = await import('../services/launchTracker.js');
      top = tracker.peekLastLaunch();
      if (!top) return;
      pre = top.entry?.preLaunchBalance;
      if (!(typeof pre === 'number' && pre > 0)) return;

      recoveryRef.current = {
        attempts: recoveryRef.current.attempts + 1,
        lastAttemptAt: now,
        active: true,
      };
      launchBlockedRef.current = true;

      // Hold display at pre-launch value while recovery runs.
      freezeBalance(pre, 4000);

      console.log('[BalanceRecovery] attempt', recoveryRef.current.attempts, 'for', top.provider);
      const result = await tracker.recoverLastLaunch();
      console.log('[BalanceRecovery] result:', result?.result?.success ? 'OK' : (result?.result?.error || 'failed'));
    } catch (err) {
      console.warn('[BalanceRecovery] threw:', err?.message);
    } finally {
      recoveryRef.current.active = false;
      // Don't immediately unblock — let the next balance poll confirm.
      // If the next balance reads > 0, the watcher above clears the block.
      // If still 0 and we still have attempts left, we'll try again after
      // the 5s cool-off.
    }
  }, [freezeBalance]);

  // Check for existing session on mount - OTP-based auth (no tokens)
  useEffect(() => {
    const loadUser = async () => {
      const storedUser = localStorage.getItem('user');
      const storedAccountId = localStorage.getItem('accountId');

      if (!storedUser || !storedAccountId) {
        console.log('[Auth] No stored session found');
        setLoading(false);
        return;
      }

      console.log('[Auth] Restoring session from localStorage');

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
      } catch (e) {
        console.error('[Auth] Error loading stored user:', e);
        // Clear invalid data
        localStorage.removeItem('user');
        localStorage.removeItem('accountId');
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  // Periodic balance refresh when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshBalance = async () => {
      // Hold the displayed balance steady during a freeze window.
      if (isBalanceFrozen()) return;
      const storedAccountId = localStorage.getItem('accountId');
      if (storedAccountId) {
        try {
          const balanceResult = await walletService.getBalance(storedAccountId);
          if (balanceResult.success) {
            setUser(prev => {
              if (!prev) return prev;
              if (isBalanceFrozen()) return prev;
              // Always update if balance changed
              if (prev.balance !== balanceResult.balance) {
                const updated = { ...prev, balance: balanceResult.balance, availableBalance: balanceResult.balance };
                localStorage.setItem('user', JSON.stringify(updated));
                return updated;
              }
              return prev;
            });
            // After the update applies, give the auto-recovery watcher a
            // chance to react if balance dropped to 0 with an active launch
            // on the LIFO stack.
            maybeAutoRecover(Number(balanceResult.balance) || 0).catch(() => {});
          }
        } catch (e) {
          // Silently fail - will retry on next interval
        }
      }
    };

    // Check localStorage for updates from admin panel
    const checkLocalStorage = () => {
      if (isBalanceFrozen()) return;
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setUser(prev => {
            if (!prev) return prev;
            if (isBalanceFrozen()) return prev;
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
        if (isBalanceFrozen()) return;
        try {
          const userData = JSON.parse(e.newValue);
          setUser(prev => {
            if (!prev) return prev;
            if (isBalanceFrozen()) return prev;
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

    // API refresh on an adaptive cadence:
    //   - 3s while the player is actually in a game (any provider page
    //     mounting the .game-player-overlay iframe), so post-spin balance
    //     feels near real-time and players don't panic
    //   - 10s otherwise, to keep wallet-service load low while in the lobby
    // Self-rescheduling setTimeout (not setInterval) so the delay can flip
    // mid-flight without restarting the effect.
    let apiTimer = null;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refreshBalance();
      if (cancelled) return;
      const inGame = !!document.querySelector('.game-player-overlay');
      const delay = inGame ? 3000 : 10000;
      apiTimer = setTimeout(tick, delay);
    };
    // Kick off immediately, then schedule the next tick from inside.
    tick();

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(localStorageInterval);
      if (apiTimer) clearTimeout(apiTimer);
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
    // Honour the freeze window — pages that explicitly want to override the
    // freeze (e.g. force-recover after a stuck exit) can call freezeBalance
    // with duration 0 first, then updateBalance.
    if (isBalanceFrozen()) return;
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
  }, [isBalanceFrozen]);

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
    freezeBalance,
    isLaunchBlocked,
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
