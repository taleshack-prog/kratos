import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export function useMyProfile() {
  return useQuery({
    queryKey: ['athlete', 'me'],
    queryFn: async () => (await api.get('/athletes/me')).data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRanking() {
  return useQuery({
    queryKey: ['athletes', 'ranking'],
    queryFn: async () => (await api.get('/athletes/ranking')).data,
    staleTime: 2 * 60 * 1000,
  });
}

export function useDependents() {
  return useQuery({
    queryKey: ['athlete', 'dependents'],
    queryFn: async () => (await api.get('/athletes/me/dependents')).data,
  });
}

export function useNearbyCourts(lat: number, lng: number, radiusKm = 5) {
  return useQuery({
    queryKey: ['courts', 'nearby', lat, lng],
    queryFn: async () => (await api.get('/courts/nearby', { params: { lat, lng, radius: radiusKm } })).data,
    enabled: !!lat && !!lng,
    staleTime: 3 * 60 * 1000,
  });
}

export function useMatches(courtId?: string) {
  return useQuery({
    queryKey: ['matches', courtId],
    queryFn: async () => (await api.get('/matches', { params: courtId ? { courtId } : undefined })).data,
    staleTime: 60 * 1000,
  });
}

export function useScheduleMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: any) => (await api.post('/matches/schedule', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  });
}

export function useCheckinP2P() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: any) => (await api.post('/checkin/p2p', dto)).data,
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['matches', v.matchId] }),
  });
}

export function useMyReports() {
  return useQuery({
    queryKey: ['zeladoria', 'mine'],
    queryFn: async () => (await api.get('/zeladoria/mine')).data,
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: any) => (await api.post('/zeladoria', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zeladoria'] }),
  });
}

export function usePendingAuthorizations() {
  return useQuery({
    queryKey: ['parents', 'authorizations'],
    queryFn: async () => (await api.get('/parents/authorizations/pending')).data,
    refetchInterval: 30 * 1000,
  });
}

export function useRespondAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ authId, decision }: { authId: string; decision: 'approved' | 'denied' }) =>
      (await api.post(`/parents/authorizations/${authId}/respond`, { status: decision })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parents', 'authorizations'] }),
  });
}

export function useMyReputation() {
  return useQuery({
    queryKey: ['reputation', 'me'],
    queryFn: async () => (await api.get('/reputation/me')).data,
    staleTime: 5 * 60 * 1000,
  });
}
