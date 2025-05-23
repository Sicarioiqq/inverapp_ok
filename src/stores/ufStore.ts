import { create } from 'zustand';
import { fetchLatestUFValue } from '../lib/ufUtils';

interface UFState {
  ufValue: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  fetchUFValue: () => Promise<void>;
}

export const useUFStore = create<UFState>((set) => ({
  ufValue: null,
  loading: false,
  error: null,
  lastUpdated: null,
  fetchUFValue: async () => {
    try {
      set({ loading: true, error: null });
      const value = await fetchLatestUFValue();
      set({ 
        ufValue: value, 
        loading: false,
        lastUpdated: new Date()
      });
    } catch (err: any) {
      console.error('Error fetching UF value:', err);
      set({ 
        error: err.message || 'Error al obtener valor UF', 
        loading: false 
      });
    }
  }
}));