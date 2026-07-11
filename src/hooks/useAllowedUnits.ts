import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DonVi } from '../types';
import { getAllSubordinateIds } from '../utils/hierarchy';

export function useAllowedUnits(donViList: DonVi[]): string[] {
  const { user } = useAuth();

  const allowedDonViIds = useMemo(() => {
    if (!user) return [];
    if (user.id_don_vi === 'ALL') return donViList.map(dv => dv.id);

    const subIds = getAllSubordinateIds(user.id_don_vi, donViList);
    return [user.id_don_vi, ...subIds];
  }, [user, donViList]);

  return allowedDonViIds;
}
