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
      
      if (value) {
        console.log('UF value fetched:', value);
        set({ 
          ufValue: value, 
          loading: false,
          lastUpdated: new Date()
        });
      } else {
        set({
          error: 'No se pudo obtener el valor de la UF',
          loading: false
        });
      }
    } catch (err: any) {
      console.error('Error fetching UF value:', err);
      set({ 
        error: err.message || 'Error al obtener valor UF', 
        loading: false 
      });
    }
  }
}));