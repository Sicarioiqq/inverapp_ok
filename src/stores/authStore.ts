import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: any | null;
  loading: boolean;
  error: string | null;
  setSession: (session: Session | null) => void;
  setUser: (user: any) => void;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,
  error: null,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  signOut: async () => {
    try {
      // Clear local state first
      set({ session: null, user: null });
      
      // Clear any stored session data
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
      
      // Attempt to sign out from Supabase
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (error) {
        console.error('Error during Supabase signOut:', error);
        // Even if Supabase signOut fails, we've already cleared the local state
      }
    } catch (error) {
      console.error('Error in signOut:', error);
      set({ error: error.message || 'Error signing out' });
      throw error;
    }
  },
  initialize: async () => {
    try {
      set({ loading: true, error: null });
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }
      
      set({ session, loading: false });

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, loading: false });
      });

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ loading: false, error: error.message || 'Failed to initialize authentication' });
    }
  },
}));