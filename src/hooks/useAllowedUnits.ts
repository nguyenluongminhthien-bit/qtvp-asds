import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DonVi } from '../types';
import { getAllSubordinateIds } from '../utils/hierarchy';

export function useAllowedUnits(donViList: DonVi[]): string[] {
  const { user } = useAuth();

  const allowedDonViIds = useMemo(() => {
    if (!user) return [];
    const userIdDonVi = String(user.id_don_vi || (user as any).idDonVi || '').trim();
    if (!userIdDonVi || userIdDonVi === 'ALL' || userIdDonVi === 'HO' || userIdDonVi === 'DV_HO') {
      return donViList.map(dv => String(dv.id || ''));
    }

    const subIds = getAllSubordinateIds(userIdDonVi, donViList);
    return Array.from(new Set([userIdDonVi, ...subIds])).map(String);
  }, [user, donViList]);

  return allowedDonViIds;
}
