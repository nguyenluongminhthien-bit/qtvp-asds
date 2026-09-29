import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DonVi } from '../types';
import { getUserPermittedUnitIds } from '../utils/hierarchy';
import { MODULE_UNIT_RULE_PREFIXES } from '../constants/permissions';

export function useAllowedUnits(donViList: DonVi[], moduleId?: string): string[] {
  const { user } = useAuth();

  const allowedDonViIds = useMemo(() => {
    if (!user) return [];

    // 🟢 Nếu có chỉ định moduleId, kiểm tra xem tài khoản có thiết lập giới hạn đơn vị riêng cho phân hệ này không
    if (moduleId && user.quyen_chi_tiet) {
      const prefix = MODULE_UNIT_RULE_PREFIXES[moduleId];
      if (prefix) {
        const rules = user.quyen_chi_tiet.split(',').map(r => r.trim());
        const rule = rules.find(r => r.startsWith(prefix));
        if (rule) {
          const ids = rule.substring(prefix.length).split('|').map(s => s.trim()).filter(Boolean);
          if (ids.length > 0) {
            return ids;
          }
        }
      }
    }

    // Mặc định: theo phạm vi Đơn vị quản lý của tài khoản
    const permittedSet = getUserPermittedUnitIds(user, donViList);
    if (!permittedSet) {
      return donViList.map(dv => String(dv.id || ''));
    }
    return donViList
      .filter(dv => permittedSet.has(String(dv.id)))
      .map(dv => String(dv.id));
  }, [user, donViList, moduleId]);

  return allowedDonViIds;
}
