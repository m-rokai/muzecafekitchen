import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { adminAPI } from '../utils/api';

export function useStaffAccess(requiredRole = 'staff') {
  const [authState, setAuthState] = useState('checking');
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let version = 0;
    let timer;
    let disposed = false;

    async function verify(currentVersion) {
      let state = 'unauthenticated';
      let message = null;
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
          state = 'authenticated';
        }
      } catch (error) {
        message = error.status === 403
          ? 'This account does not have access. Use an authorized work email.'
          : error.message || 'Unable to verify your sign-in. Please try again.';
      }
      if (!disposed && currentVersion === version) {
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
  }, [requiredRole]);

  return { authState, authError };
}
