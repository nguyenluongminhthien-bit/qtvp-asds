import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DonVi } from '../types';
import { getUserPermittedUnitIds } from '../utils/hierarchy';

export function useAllowedUnits(donViList: DonVi[]): string[] {
  const { user } = useAuth();

  const allowedDonViIds = useMemo(() => {
    if (!user) return [];
    const permittedSet = getUserPermittedUnitIds(user, donViList);
    if (!permittedSet) {
      return donViList.map(dv => String(dv.id || ''));
    }
    return donViList
      .filter(dv => permittedSet.has(String(dv.id)))
      .map(dv => String(dv.id));
  }, [user, donViList]);

  return allowedDonViIds;
}
