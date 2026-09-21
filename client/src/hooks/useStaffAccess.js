import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { adminAPI } from '../utils/api';

export function useStaffAccess(requiredRole = 'staff') {
  const [authState, setAuthState] = useState('checking');
  const [authError, setAuthError] = useState(null);
  const [role, setRole] = useState(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    let version = 0;
    let timer;
    let disposed = false;

    async function verify(currentVersion) {
      let state = 'unauthenticated';
      let message = null;
      let verifiedRole = null;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session && !data.session.user.is_anonymous) {
          const result = await adminAPI.verifyToken();
          if (requiredRole === 'admin' && result.auth?.role !== 'admin') {
            throw new Error('This account does not have administrator access. Use an authorized work email.');
          }
          if (!['admin', 'staff'].includes(result.auth?.role)) {
            throw new Error('This account does not have staff access. Use an authorized work email.');
          }
          verifiedRole = result.auth.role;
          state = 'authenticated';
        }
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          message = error.status === 403
            ? 'This account does not have access. Use an authorized work email.'
            : 'Your saved session has expired. Please sign in again.';
        } else {
          state = 'error';
          message = error.message || 'Unable to verify your saved session. Please try again.';
        }
      }
      if (!disposed && currentVersion === version) {
        setRole(verifiedRole);
        setAuthError(message);
        setAuthState(state);
      }
    }

    function scheduleVerification() {
      const currentVersion = ++version;
      clearTimeout(timer);
      // Run Supabase auth methods outside its auth event callback lock.
      timer = setTimeout(() => verify(currentVersion), 0);
    }

    scheduleVerification();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(scheduleVerification);
    return () => {
      disposed = true;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [requiredRole, retryVersion]);

  return {
    authState,
    authError,
    role,
    retry: () => {
      setAuthState('checking');
      setRetryVersion(value => value + 1);
    },
  };
}
