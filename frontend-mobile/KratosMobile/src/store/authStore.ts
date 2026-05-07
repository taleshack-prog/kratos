import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

export interface AthleteSession {
  id: string;
  name: string;
  email: string;
  eloComposite: number;
  isCaptain: boolean;
  isMinor: boolean;
}

interface AuthState {
  athlete: AthleteSession | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  register: (dto: any) => Promise<void>;
  login: (dto: any) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  athlete: null,
  token: null,
  isLoading: false,
  error: null,

  loadFromStorage: async () => {
    const token = await AsyncStorage.getItem('accessToken');
    const athleteStr = await AsyncStorage.getItem('athlete');
    if (token && athleteStr) {
      set({ token, athlete: JSON.parse(athleteStr) });
    }
  },

  register: async (dto) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/register', dto);
      await AsyncStorage.setItem('accessToken', data.accessToken);
      await AsyncStorage.setItem('athlete', JSON.stringify(data.athlete));
      set({ token: data.accessToken, athlete: data.athlete, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Erro ao cadastrar', isLoading: false });
      throw err;
    }
  },

  login: async (dto) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', dto);
      await AsyncStorage.setItem('accessToken', data.accessToken);
      await AsyncStorage.setItem('athlete', JSON.stringify(data.athlete));
      set({ token: data.accessToken, athlete: data.athlete, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Credenciais inválidas', isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('athlete');
    set({ athlete: null, token: null, error: null });
  },
}));
