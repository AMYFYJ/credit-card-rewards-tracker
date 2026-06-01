import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase, type Json } from './supabaseClient';
import {
  CURRENT_STATE_VERSION,
  cacheState,
  normalizeRewardsState,
  type RewardsState,
} from './trackerState';

export type SyncStatus = 'sign-in' | 'saving' | 'saved' | 'offline' | 'error';

export type TrackerSync = {
  status: SyncStatus;
  userEmail: string | null;
  lastSavedAt: string | null;
  message: string;
  isConfigured: boolean;
  isSubmittingAuth: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SAVE_DEBOUNCE_MS = 750;

export function useTrackerSync(
  state: RewardsState,
  setState: Dispatch<SetStateAction<RewardsState>>,
): TrackerSync {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(!isSupabaseConfigured);
  const [isRemoteReady, setIsRemoteReady] = useState(false);
  const [isOnline, setIsOnline] = useState(() => getOnlineStatus());
  const [status, setStatus] = useState<SyncStatus>('sign-in');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const stateRef = useRef(state);
  const lastSavedAtRef = useRef<string | null>(lastSavedAt);
  const loadedRemoteUserIdRef = useRef<string | null>(null);
  const pendingOfflineChangesRef = useRef(false);
  const skipNextRemoteSaveRef = useRef(false);

  useEffect(() => {
    lastSavedAtRef.current = lastSavedAt;
  }, [lastSavedAt]);

  useEffect(() => {
    stateRef.current = state;
    cacheState(state, new Date().toISOString(), lastSavedAtRef.current);
  }, [state]);

  useEffect(() => {
    if (session?.user && !isRemoteReady && !isOnline) {
      pendingOfflineChangesRef.current = true;
    }
  }, [isOnline, isRemoteReady, session?.user, state]);

  useEffect(() => {
    const syncOnlineStatus = () => setIsOnline(getOnlineStatus());

    window.addEventListener('online', syncOnlineStatus);
    window.addEventListener('offline', syncOnlineStatus);

    return () => {
      window.removeEventListener('online', syncOnlineStatus);
      window.removeEventListener('offline', syncOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setMessage('Add Supabase env vars to enable sync.');
      setStatus('sign-in');
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) {
          return;
        }
        setSession(data.session);
        setIsAuthReady(true);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }
        setMessage(getErrorMessage(error));
        setStatus('error');
        setIsAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        loadedRemoteUserIdRef.current = null;
        pendingOfflineChangesRef.current = false;
        setIsRemoteReady(false);
        setLastSavedAt(null);
        setStatus('sign-in');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !isAuthReady) {
      return;
    }

    const userId = session?.user?.id;

    if (!userId) {
      loadedRemoteUserIdRef.current = null;
      pendingOfflineChangesRef.current = false;
      setIsRemoteReady(false);
      setStatus('sign-in');
      return;
    }

    if (loadedRemoteUserIdRef.current === userId) {
      return;
    }

    if (!isOnline) {
      setIsRemoteReady(false);
      setStatus('offline');
      setMessage('Changes are saved on this device.');
      return;
    }

    let isCancelled = false;

    async function loadRemoteState() {
      if (!supabase || !userId) {
        return;
      }

      setIsRemoteReady(false);
      setStatus('saving');
      setMessage('');

      if (pendingOfflineChangesRef.current) {
        const { error: offlineSaveError, savedAt: offlineSavedAt } = await saveRemoteState(
          userId,
          stateRef.current,
        );

        if (isCancelled) {
          return;
        }

        if (offlineSaveError) {
          setStatus('error');
          setMessage(offlineSaveError);
          return;
        }

        if (!offlineSavedAt) {
          return;
        }

        pendingOfflineChangesRef.current = false;
        cacheState(stateRef.current, offlineSavedAt, offlineSavedAt);
        setLastSavedAt(offlineSavedAt);
        skipNextRemoteSaveRef.current = true;
        setStatus('saved');
        loadedRemoteUserIdRef.current = userId;
        setIsRemoteReady(true);
        return;
      }

      const { data, error } = await supabase
        .from('reward_tracker_states')
        .select('state, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (isCancelled) {
        return;
      }

      if (error) {
        setStatus('error');
        setMessage(error.message);
        return;
      }

      if (data) {
        const remoteState = normalizeRewardsState(data.state);
        skipNextRemoteSaveRef.current = true;
        setState(remoteState);
        cacheState(remoteState, data.updated_at, data.updated_at);
        setLastSavedAt(data.updated_at);
        setStatus('saved');
        loadedRemoteUserIdRef.current = userId;
        setIsRemoteReady(true);
        return;
      }

      const { error: saveError, savedAt } = await saveRemoteState(
        userId,
        stateRef.current,
      );
      if (isCancelled) {
        return;
      }

      if (saveError) {
        setStatus('error');
        setMessage(saveError);
        return;
      }

      if (!savedAt) {
        return;
      }

      cacheState(stateRef.current, savedAt, savedAt);
      setLastSavedAt(savedAt);
      skipNextRemoteSaveRef.current = true;
      setStatus('saved');
      loadedRemoteUserIdRef.current = userId;
      setIsRemoteReady(true);
    }

    void loadRemoteState();

    return () => {
      isCancelled = true;
    };
  }, [isAuthReady, isOnline, session?.user?.id, setState]);

  useEffect(() => {
    if (!supabase || !session?.user || !isRemoteReady) {
      return;
    }

    if (skipNextRemoteSaveRef.current) {
      skipNextRemoteSaveRef.current = false;
      return;
    }

    if (!isOnline) {
      setStatus('offline');
      setMessage('Changes are saved on this device.');
      return;
    }

    setStatus('saving');
    setMessage('');

    const timeoutId = window.setTimeout(() => {
      void saveRemoteState(session.user.id, state).then(({ error, savedAt }) => {
        if (error) {
          setStatus('error');
          setMessage(error);
          return;
        }

        if (!savedAt) {
          return;
        }

        cacheState(state, savedAt, savedAt);
        setLastSavedAt(savedAt);
        setStatus('saved');
      });
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isOnline, isRemoteReady, session?.user?.id, state]);

  const signInWithPassword = async (email: string, password: string) => {
    if (!supabase) {
      setStatus('error');
      setMessage('Add Supabase env vars to enable sync.');
      return;
    }

    setIsSubmittingAuth(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmittingAuth(false);

    if (error) {
      setStatus('error');
      setMessage(getPasswordSignInMessage(error.message));
      return;
    }

    setStatus('saving');
    setMessage('');
  };

  const signUpWithPassword = async (email: string, password: string) => {
    if (!supabase) {
      setStatus('error');
      setMessage('Add Supabase env vars to enable sync.');
      return;
    }

    setIsSubmittingAuth(true);
    setMessage('');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setIsSubmittingAuth(false);

    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }

    if (data.session) {
      setStatus('saving');
      setMessage('');
      return;
    }

    setStatus('sign-in');
    setMessage('Account created. Disable Confirm email in Supabase to sign in immediately.');
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }

    setSession(null);
    loadedRemoteUserIdRef.current = null;
    pendingOfflineChangesRef.current = false;
    setIsRemoteReady(false);
    setLastSavedAt(null);
    setStatus('sign-in');
    setMessage('');
  };

  return {
    status,
    userEmail: session?.user.email ?? null,
    lastSavedAt,
    message,
    isConfigured: isSupabaseConfigured,
    isSubmittingAuth,
    signInWithPassword,
    signUpWithPassword,
    signOut,
  };
}

async function saveRemoteState(
  userId: string,
  state: RewardsState,
): Promise<{ savedAt: string | null; error: string | null }> {
  if (!supabase) {
    return { error: 'Add Supabase env vars to enable sync.', savedAt: null };
  }

  try {
    const { data, error } = await supabase
      .from('reward_tracker_states')
      .upsert(
        {
          user_id: userId,
          state: normalizeRewardsState(state) as unknown as Json,
          version: CURRENT_STATE_VERSION,
        },
        { onConflict: 'user_id' },
      )
      .select('updated_at')
      .single();

    if (error) {
      return { error: error.message, savedAt: null };
    }

    return { error: null, savedAt: data.updated_at };
  } catch (error) {
    return { error: getErrorMessage(error), savedAt: null };
  }
}

function getOnlineStatus(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Sync failed.';
}

function getPasswordSignInMessage(message: string): string {
  return message.toLowerCase().includes('invalid login credentials')
    ? 'No account found for that email and password. Create an account first.'
    : message;
}
