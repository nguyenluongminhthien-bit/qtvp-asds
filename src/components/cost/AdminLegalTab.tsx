import React, { useState, useMemo } from 'react';
import {
  Building2, Layers, Tag, Plus, Edit, Trash2, CheckCircle2,
  XCircle, AlertCircle, RefreshCw, Search, ShieldCheck,
  ChevronRight, ArrowRight, Star, Filter, CheckSquare, Square, X, Check
} from 'lucide-react';
import { DmBoPhan, BoPhanCap1, BoPhanCap2, DonVi, PhapNhan } from '../../types';
import { apiService } from '../../services/api';
import { toast } from '../../utils/toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAllSubordinateIds,
  buildHierarchicalOptions,
  getUnitEmoji,
  getUserPermittedUnitIds,
  isUserAdminOrAllAccess
} from '../../utils/hierarchy';

interface Props {
  boPhanList?: DmBoPhan[];
  cap1List: BoPhanCap1[];
  cap2List: BoPhanCap2[];
  donViList: DonVi[];
  allDonViList?: DonVi[];
  phapNhanList: PhapNhan[];
  selectedUnitFilter?: string;
  onRefresh: () => Promise<void>;
  loading: boolean;
  activeSubTab?: 'bophan' | 'phapnhan';
  setActiveSubTab?: (tab: 'bophan' | 'phapnhan') => void;
}

const DEFAULT_BO_PHAN: DmBoPhan[] = [
  { id: 'BP_KDX_KIA', ma_cap1: 'KD_XE', ten_cap1: 'Kinh doanh xe', ma_cap2: 'KIA', ten_cap2: 'Kia', thu_tu: 1, active: true },
  { id: 'BP_KDX_MAZDA', ma_cap1: 'KD_XE', ten_cap1: 'Kinh doanh xe', ma_cap2: 'MAZDA', ten_cap2: 'Mazda', thu_tu: 2, active: true },
  { id: 'BP_KDX_PEUGEOT', ma_cap1: 'KD_XE', ten_cap1: 'Kinh doanh xe', ma_cap2: 'PEUGEOT', ten_cap2: 'Peugeot', thu_tu: 3, active: true },
  { id: 'BP_KDX_BMW', ma_cap1: 'KD_XE', ten_cap1: 'Kinh doanh xe', ma_cap2: 'BMW', ten_cap2: 'BMW', thu_tu: 4, active: true },
  { id: 'BP_KDX_TAIBUS', ma_cap1: 'KD_XE', ten_cap1: 'Kinh doanh xe', ma_cap2: 'TAI_BUS', ten_cap2: 'Tải / Bus', thu_tu: 5, active: true },
  { id: 'BP_KDDV_KIA', ma_cap1: 'KD_DV', ten_cap1: 'Kinh doanh DV', ma_cap2: 'DV_KIA', ten_cap2: 'Dịch vụ Kia', thu_tu: 10, active: true },
  { id: 'BP_KDDV_MAZDA', ma_cap1: 'KD_DV', ten_cap1: 'Kinh doanh DV', ma_cap2: 'DV_MAZDA', ten_cap2: 'Dịch vụ Mazda', thu_tu: 11, active: true },
  { id: 'BP_KDDV_PEUGEOT', ma_cap1: 'KD_DV', ten_cap1: 'Kinh doanh DV', ma_cap2: 'DV_PEUGEOT', ten_cap2: 'Dịch vụ Peugeot', thu_tu: 12, active: true },
  { id: 'BP_KDDV_CHUNG', ma_cap1: 'KD_DV', ten_cap1: 'Kinh doanh DV', ma_cap2: 'DV_CHUNG', ten_cap2: 'Dịch vụ Chung', thu_tu: 13, active: true },
  { id: 'BP_NVQT_QTVP', ma_cap1: 'NVQT', ten_cap1: 'Nghiệp vụ Quản trị', ma_cap2: 'QTVP', ten_cap2: 'Quản trị Văn phòng', thu_tu: 20, active: true },
  { id: 'BP_NVQT_MKT', ma_cap1: 'NVQT', ten_cap1: 'Nghiệp vụ Quản trị', ma_cap2: 'MKT', ten_cap2: 'Marketing', thu_tu: 21, active: true },
  { id: 'BP_NVQT_HR', ma_cap1: 'NVQT', ten_cap1: 'Nghiệp vụ Quản trị', ma_cap2: 'HR', ten_cap2: 'Nhân sự / HCNS', thu_tu: 22, active: true },
  { id: 'BP_NVQT_KTTC', ma_cap1: 'NVQT', ten_cap1: 'Nghiệp vụ Quản trị', ma_cap2: 'KTTC', ten_cap2: 'Kế toán Tài chính', thu_tu: 23, active: true },
  { id: 'BP_NVQT_IT', ma_cap1: 'NVQT', ten_cap1: 'Nghiệp vụ Quản trị', ma_cap2: 'IT', ten_cap2: 'Công nghệ Thông tin', thu_tu: 24, active: true },
  { id: 'BP_NVQT_BGD', ma_cap1: 'NVQT', ten_cap1: 'Nghiệp vụ Quản trị', ma_cap2: 'BGD', ten_cap2: 'Ban Giám đốc', thu_tu: 25, active: true },
  { id: 'BP_DC_CHUNG', ma_cap1: 'DUNG_CHUNG', ten_cap1: 'Dùng chung & Khác', ma_cap2: 'CHUNG', ten_cap2: 'Chi phí dùng chung', thu_tu: 30, active: true }
];

export default function AdminLegalTab({
  boPhanList,
  cap1List,
  cap2List,
  donViList,
  allDonViList,
  phapNhanList,
  selectedUnitFilter,
  onRefresh,
  loading,
  activeSubTab: externalActiveSubTab,
  setActiveSubTab: externalSetActiveSubTab
}: Props) {
  const { user } = useAuth();
  const isGlobalAdmin = isUserAdminOrAllAccess(user);

  const [internalActiveSubTab, setInternalActiveSubTab] = useState<'bophan' | 'phapnhan'>('bophan');
  const activeSubTab = externalActiveSubTab !== undefined ? externalActiveSubTab : internalActiveSubTab;
  const setActiveSubTab = externalSetActiveSubTab !== undefined ? externalSetActiveSubTab : setInternalActiveSubTab;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKhoi, setFilterKhoi] = useState<string>('ALL');
  const [filterDonVi, setFilterDonVi] = useState<string>(selectedUnitFilter || 'ALL');

  // Cập nhật filterDonVi khi selectedUnitFilter từ ngoài thay đổi
  React.useEffect(() => {
    if (selectedUnitFilter) {
      setFilterDonVi(selectedUnitFilter);
    }
  }, [selectedUnitFilter]);

  const fullDonViList = useMemo(() => (allDonViList && allDonViList.length > 0 ? allDonViList : donViList), [allDonViList, donViList]);
  const donViMap = useMemo(() => new Map<string, DonVi>(fullDonViList.map(d => [String(d.id), d])), [fullDonViList]);

  // Kiểm tra đơn vị có phải là Đại lý hay không (loại trừ đại lý khỏi danh mục bộ phận)
  const isDonViDaiLy = (u: DonVi): boolean => {
    const trangThai = String(u.trang_thai || '').toLowerCase().trim();
    const loaiHinh = String(u.loai_hinh || '').toLowerCase().trim();
    const ten = String(u.ten_don_vi || '').toLowerCase().trim();
    return (
      trangThai === 'đại lý' ||
      loaiHinh === 'đại lý' ||
      ten.startsWith('đại lý') ||
      ten.startsWith('đl ') ||
      ten.includes('đại lý')
    );
  };

  // Tập hợp ID đơn vị được phân quyền cho tài khoản
  const userPermittedUnitIds = useMemo(() => {
    return getUserPermittedUnitIds(user, fullDonViList);
  }, [user, fullDonViList]);

  // Danh sách các đơn vị được phép gán bộ phận theo phân quyền (loại bỏ đại lý)
  const allowedUnitsForDept = useMemo(() => {
    const list = fullDonViList.filter(u => !isDonViDaiLy(u));
    if (!userPermittedUnitIds) return list;
    return list.filter(u => userPermittedUnitIds.has(String(u.id)));
  }, [fullDonViList, userPermittedUnitIds]);

  // Cây phân cấp đơn vị theo phân quyền
  const hierarchicalUnitOptions = useMemo(() => {
    return buildHierarchicalOptions(allowedUnitsForDept);
  }, [allowedUnitsForDept]);

  // Kiểm tra xem bộ phận có áp dụng cho đơn vị target hay không (hỗ trợ nhiều đơn vị phân tách bằng dấu phẩy)
  const isUnitInBoPhan = (itemDonViId: string | null | undefined, targetUnitId: string): boolean => {
    if (!itemDonViId) return false;
    const ids = String(itemDonViId).split(',').map(s => s.trim()).filter(Boolean);
    return ids.includes(String(targetUnitId));
  };

  // Danh sách bộ phận thực tế (nếu boPhanList rỗng, dùng default)
  const effectiveBoPhanList = useMemo(() => {
    if (boPhanList && boPhanList.length > 0) return boPhanList;
    return DEFAULT_BO_PHAN;
  }, [boPhanList]);

  // Kiểm tra đơn vị đang chọn đã có bộ phận riêng chưa
  const isSpecificUnitSelected = filterDonVi !== 'ALL' && filterDonVi !== 'GLOBAL';
  const hasUnitCustomDepartments = useMemo(() => {
    if (!isSpecificUnitSelected) return true;
    return effectiveBoPhanList.some(b => isUnitInBoPhan(b.id_don_vi, filterDonVi));
  }, [isSpecificUnitSelected, effectiveBoPhanList, filterDonVi]);

  // Modals for Bộ phận
  const [isBoPhanModalOpen, setIsBoPhanModalOpen] = useState(false);
  const [boPhanMode, setBoPhanMode] = useState<'create' | 'update'>('create');
  const [boPhanForm, setBoPhanForm] = useState<Partial<DmBoPhan>>({
    id_don_vi: null,
    ma_cap1: 'KD_XE',
    ten_cap1: 'Kinh doanh xe',
    ma_cap2: '',
    ten_cap2: '',
    thu_tu: 1,
    active: true
  });
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [deleteBoPhanTarget, setDeleteBoPhanTarget] = useState<DmBoPhan | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Danh sách các ID đơn vị được chọn trong form
  const selectedUnitIds = useMemo(() => {
    if (!boPhanForm.id_don_vi) return [];
    return String(boPhanForm.id_don_vi)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }, [boPhanForm.id_don_vi]);

  const handleToggleUnit = (unitId: string) => {
    setBoPhanForm(prev => {
      const current = String(prev.id_don_vi || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      let next: string[];
      if (current.includes(unitId)) {
        next = current.filter(id => id !== unitId);
      } else {
        next = [...current, unitId];
      }
      return {
        ...prev,
        id_don_vi: next.length > 0 ? next.join(',') : null
      };
    });
  };

  const handleSelectAllUnits = () => {
    const allIds = allowedUnitsForDept.map(u => String(u.id));
    setBoPhanForm(prev => ({
      ...prev,
      id_don_vi: allIds.join(',')
    }));
  };

  const handleClearAllUnits = () => {
    setBoPhanForm(prev => ({
      ...prev,
      id_don_vi: null
    }));
  };

  // Cây đơn vị lọc theo từ khóa tìm kiếm trong modal
  const displayedTreeUnits = useMemo(() => {
    if (!unitSearchQuery.trim()) {
      return hierarchicalUnitOptions;
    }
    const q = unitSearchQuery.toLowerCase().trim();
    return hierarchicalUnitOptions.filter(({ unit }) =>
      String(unit.ten_don_vi || '').toLowerCase().includes(q) ||
      String(unit.id || '').toLowerCase().includes(q) ||
      String(unit.loai_hinh || '').toLowerCase().includes(q)
    );
  }, [hierarchicalUnitOptions, unitSearchQuery]);

  // Danh sách các Khối / Nghiệp vụ (Cấp 1) duy nhất
  const uniqueKhoiList = useMemo(() => {
    const map = new Map<string, string>();
    effectiveBoPhanList.forEach(b => {
      if (b.ma_cap1 && !map.has(b.ma_cap1)) {
        map.set(b.ma_cap1, b.ten_cap1);
      }
    });
    return Array.from(map.entries()).map(([ma, ten]) => ({ ma, ten }));
  }, [effectiveBoPhanList]);

  // Bộ lọc danh sách Bộ phận
  const filteredBoPhanList = useMemo(() => {
    return effectiveBoPhanList.filter(item => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q ||
        String(item.ma_cap1 || '').toLowerCase().includes(q) ||
        String(item.ten_cap1 || '').toLowerCase().includes(q) ||
        String(item.ma_cap2 || '').toLowerCase().includes(q) ||
        String(item.ten_cap2 || '').toLowerCase().includes(q);

      const matchKhoi = filterKhoi === 'ALL' || item.ma_cap1 === filterKhoi;

      // Lọc theo Đơn vị áp dụng
      let matchDonVi = true;
      if (filterDonVi === 'GLOBAL') {
        matchDonVi = !item.id_don_vi;
      } else if (filterDonVi !== 'ALL') {
        if (hasUnitCustomDepartments) {
          matchDonVi = isUnitInBoPhan(item.id_don_vi, filterDonVi);
        } else {
          matchDonVi = !item.id_don_vi;
        }
      } else if (userPermittedUnitIds) {
        // Tài khoản cấp đơn vị khi chọn ALL: chỉ xem mẫu chung hoặc bộ phận của các đơn vị thuộc quyền
        if (item.id_don_vi) {
          const ids = String(item.id_don_vi).split(',').map(s => s.trim()).filter(Boolean);
          matchDonVi = ids.some(id => userPermittedUnitIds.has(id));
        } else {
          matchDonVi = true;
        }
      }

      return matchSearch && matchKhoi && matchDonVi;
    }).sort((a, b) => (Number(a.thu_tu) || 0) - (Number(b.thu_tu) || 0));
  }, [effectiveBoPhanList, searchTerm, filterKhoi, filterDonVi, hasUnitCustomDepartments, userPermittedUnitIds]);

  // =========================================================================
  // HANDLERS CHO BỘ PHẬN
  // =========================================================================
  const handleOpenAddBoPhan = () => {
    setBoPhanMode('create');
    const firstKhoi = uniqueKhoiList[0] || { ma: 'KD_XE', ten: 'Kinh doanh xe' };
    
    let defaultIdDonVi: string | null = null;
    if (isSpecificUnitSelected) {
      defaultIdDonVi = filterDonVi;
    } else if (!isGlobalAdmin && userPermittedUnitIds && userPermittedUnitIds.size > 0) {
      const uId = user?.id_don_vi ? String(user.id_don_vi) : '';
      const permittedArr = Array.from(userPermittedUnitIds) as string[];
      defaultIdDonVi = uId && userPermittedUnitIds.has(uId)
        ? uId
        : (permittedArr[0] || null);
    }

    setBoPhanForm({
      id_don_vi: defaultIdDonVi,
      ma_cap1: firstKhoi.ma,
      ten_cap1: firstKhoi.ten,
      ma_cap2: '',
      ten_cap2: '',
      thu_tu: (effectiveBoPhanList.length || 0) + 1,
      active: true
    });
    setUnitSearchQuery('');
    setIsBoPhanModalOpen(true);
  };

  const handleOpenEditBoPhan = (item: DmBoPhan) => {
    setBoPhanMode('update');
    setBoPhanForm({ ...item });
    setUnitSearchQuery('');
    setIsBoPhanModalOpen(true);
  };

  // Sao chép mẫu chuẩn toàn quốc sang đơn vị đang chọn
  const handleCopyTemplateForUnit = async (targetUnitId: string) => {
    if (!targetUnitId || targetUnitId === 'ALL' || targetUnitId === 'GLOBAL') return;
    const targetUnit = donViMap.get(String(targetUnitId));
    const confirmCopy = window.confirm(`Bạn có chắc muốn sao chép toàn bộ danh mục Khối & Thương hiệu mẫu chuẩn sang "${targetUnit?.ten_don_vi || targetUnitId}" để tùy biến riêng?`);
    if (!confirmCopy) return;

    setSubmitting(true);
    try {
      const templateItems = effectiveBoPhanList.filter(b => !b.id_don_vi);
      const itemsToCopy = templateItems.length > 0 ? templateItems : DEFAULT_BO_PHAN;

      let count = 0;
      for (const item of itemsToCopy) {
        const newPayload = {
          ma_cap1: item.ma_cap1,
          ten_cap1: item.ten_cap1,
          ma_cap2: item.ma_cap2,
          ten_cap2: item.ten_cap2,
          thu_tu: item.thu_tu || 0,
          id_don_vi: targetUnitId,
          active: true
        };
        await apiService.save(newPayload, 'create', 'dm_bo_phan');
        count++;
      }

      toast.success(`Đã sao chép thành công ${count} bộ phận sang ${targetUnit?.ten_don_vi || targetUnitId}!`);
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi sao chép mẫu chuẩn: ' + (err?.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBoPhan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boPhanForm.ma_cap1?.trim() || !boPhanForm.ten_cap1?.trim()) {
      toast.warning('Vui lòng chọn hoặc nhập Khối / Nghiệp vụ (Cấp 1)!');
      return;
    }
    if (!boPhanForm.ma_cap2?.trim() || !boPhanForm.ten_cap2?.trim()) {
      toast.warning('Vui lòng nhập đầy đủ Mã và Tên Thương hiệu / Phòng / Bộ phận (Cấp 2)!');
      return;
    }

    // Nếu không phải Admin, bắt buộc phải chọn ít nhất 1 đơn vị áp dụng trong phạm vi phân quyền
    if (!isGlobalAdmin && selectedUnitIds.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 đơn vị áp dụng trong phạm vi phân quyền!');
      return;
    }

    setSubmitting(true);
    try {
      const basePayload = {
        ma_cap1: boPhanForm.ma_cap1.trim().toUpperCase(),
        ten_cap1: boPhanForm.ten_cap1.trim(),
        ma_cap2: boPhanForm.ma_cap2.trim().toUpperCase(),
        ten_cap2: boPhanForm.ten_cap2.trim(),
        thu_tu: Number(boPhanForm.thu_tu) || 0,
        active: boPhanForm.active !== false
      };

      if (boPhanMode === 'create') {
        const targetUnitIds = selectedUnitIds.length > 0 ? selectedUnitIds : [null];
        for (let i = 0; i < targetUnitIds.length; i++) {
          const uid = targetUnitIds[i];
          const newPayload: any = {
            ...basePayload,
            id: targetUnitIds.length > 1 ? `BP_${Date.now()}_${i + 1}` : (boPhanForm.id || `BP_${Date.now()}`),
            id_don_vi: uid
          };
          await apiService.save(newPayload, 'create', 'dm_bo_phan');
        }
        toast.success(
          targetUnitIds.length > 1
            ? `Đã tạo Bộ phận mới cho ${targetUnitIds.length} đơn vị trực thuộc!`
            : 'Đã thêm Bộ phận mới!'
        );
      } else {
        // Mode update
        const primaryUnitId = selectedUnitIds[0] || null;
        const updatePayload: any = {
          ...basePayload,
          id: boPhanForm.id,
          id_don_vi: primaryUnitId
        };
        await apiService.save(updatePayload, 'update', 'dm_bo_phan');

        // Nếu người dùng chọn thêm các đơn vị khác trong lúc sửa:
        if (selectedUnitIds.length > 1) {
          for (let i = 1; i < selectedUnitIds.length; i++) {
            const uid = selectedUnitIds[i];
            const alreadyExists = effectiveBoPhanList.some(
              b => String(b.id_don_vi) === String(uid) &&
                   b.ma_cap1 === basePayload.ma_cap1 &&
                   b.ma_cap2 === basePayload.ma_cap2
            );
            if (!alreadyExists) {
              const newPayload: any = {
                ...basePayload,
                id: `BP_${Date.now()}_${i + 1}`,
                id_don_vi: uid
              };
              await apiService.save(newPayload, 'create', 'dm_bo_phan');
            }
          }
        }
        toast.success('Đã cập nhật Bộ phận thành công!');
      }

      setIsBoPhanModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Có lỗi xảy ra khi lưu Bộ phận!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBoPhan = async () => {
    if (!deleteBoPhanTarget) return;
    setSubmitting(true);
    try {
      await apiService.delete(deleteBoPhanTarget.id, 'dm_bo_phan');
      toast.success('Đã xóa Bộ phận!');
      setDeleteBoPhanTarget(null);
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Không thể xóa Bộ phận!');
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // LỌC PHÁP NHÂN & SHOWROOM THEO BỘ LỌC ĐƠN VỊ PHÍA NGOÀI
  // =========================================================================
  const currentUnit = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') return null;
    return donViList.find(u => String(u.id) === String(selectedUnitFilter));
  }, [selectedUnitFilter, donViList]);

  const familyUnitIds = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') return null;
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViList);

    // Tìm các đơn vị cấp trên (ancestors)
    const ancestors: string[] = [];
    let curr = donViList.find(u => String(u.id) === String(selectedUnitFilter));
    const visited = new Set<string>();
    while (curr && curr.cap_quan_ly && curr.cap_quan_ly !== 'HO' && curr.cap_quan_ly !== 'DV_HO' && !visited.has(curr.cap_quan_ly)) {
      visited.add(curr.cap_quan_ly);
      ancestors.push(curr.cap_quan_ly);
      curr = donViList.find(u => String(u.id) === String(curr?.cap_quan_ly));
    }

    return new Set([selectedUnitFilter, ...subIds, ...ancestors]);
  }, [selectedUnitFilter, donViList]);

  const filteredPhapNhanList = useMemo(() => {
    let list = phapNhanList;

    if (familyUnitIds) {
      // 1. Lọc theo id_don_vi liên kết trong dm_phap_nhan
      const matched = phapNhanList.filter(pn => {
        if (!pn.id_don_vi) return false;
        const uIds = String(pn.id_don_vi).split(',').map(s => s.trim());
        return uIds.some(uid => familyUnitIds.has(uid));
      });

      if (matched.length > 0) {
        list = matched;
      } else if (currentUnit?.ten_don_vi) {
        // Fallback: tìm theo từ khóa tên tỉnh thành
        const cleanName = currentUnit.ten_don_vi.toLowerCase().replace('thaco auto', '').trim();
        const words = cleanName.split(' ').filter(w => w.length > 2);
        const nameMatched = phapNhanList.filter(pn => {
          const pnName = (pn.ten_cong_ty || pn.ten_phap_nhan || '').toLowerCase();
          return words.some(w => pnName.includes(w));
        });
        if (nameMatched.length > 0) list = nameMatched;
      }
    }

    if (searchTerm.trim() && activeSubTab === 'phapnhan') {
      const q = searchTerm.toLowerCase().trim();
      return list.filter(pn =>
        String(pn.ten_cong_ty || '').toLowerCase().includes(q) ||
        String(pn.ma_so_thue || '').toLowerCase().includes(q) ||
        String(pn.dia_chi || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [familyUnitIds, phapNhanList, currentUnit, searchTerm, activeSubTab]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Sub-tabs header - Chỉ hiển thị khi dùng độc lập (không có Nested Connected Tabs từ trang cha) */}
      {!externalActiveSubTab && (
        <div className="bg-white dark:bg-slate-800 p-2 sm:p-3 rounded-xl shadow-xs border border-gray-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-700/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveSubTab('bophan')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeSubTab === 'bophan'
                ? 'bg-white dark:bg-slate-800 text-[#D97706] shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              <Layers size={15} />
              <span>Danh mục Bộ phận ({filteredBoPhanList.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('phapnhan')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeSubTab === 'phapnhan'
                ? 'bg-white dark:bg-slate-800 text-[#D97706] shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              <Building2 size={15} />
              <span>Pháp nhân & Showroom ({filteredPhapNhanList.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-200/80 dark:border-slate-700/80 overflow-hidden flex flex-col min-h-0">

        {/* ===================== SUB-TAB 1: DANH MỤC BỘ PHẬN ===================== */}
        {activeSubTab === 'bophan' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter & Search Toolbar */}
            <div className="p-3 border-b border-gray-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50 dark:bg-slate-800">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Tìm theo Khối, Mã, Tên bộ phận..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                  />
                </div>

                {/* Filter Khối / Nghiệp vụ */}
                <div className="flex items-center gap-1.5">
                  <Filter size={14} className="text-gray-400" />
                  <select
                    value={filterKhoi}
                    onChange={(e) => setFilterKhoi(e.target.value)}
                    className="py-1.5 px-2.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                  >
                    <option value="ALL">Tất cả Khối ({effectiveBoPhanList.length})</option>
                    {uniqueKhoiList.map(k => (
                      <option key={k.ma} value={k.ma}>{k.ten} ({effectiveBoPhanList.filter(b => b.ma_cap1 === k.ma).length})</option>
                    ))}
                  </select>
                </div>

                {/* Filter Đơn vị áp dụng */}
                <div className="flex items-center gap-1.5">
                  <Building2 size={14} className="text-gray-400" />
                  <select
                    value={filterDonVi}
                    onChange={(e) => setFilterDonVi(e.target.value)}
                    className="py-1.5 px-2.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                  >
                    <option value="ALL">Tất cả Đơn vị ({allowedUnitsForDept.length})</option>
                    <option value="GLOBAL">🌐 Mẫu dùng chung toàn quốc</option>
                    <optgroup label="🏢 Đơn vị phân quyền">
                      {hierarchicalUnitOptions.map(({ unit, prefix }) => (
                        <option key={unit.id} value={unit.id}>
                          {prefix}{getUnitEmoji(unit.loai_hinh)} {unit.ten_don_vi}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 italic hidden sm:block">
                  Cấp 1: <strong>Khối / Nghiệp vụ</strong> — Cấp 2: <strong>Thương hiệu / Phòng / Bộ phận</strong>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddBoPhan}
                  className="px-3 py-1.5 bg-[#D97706] hover:bg-[#b45309] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <Plus size={14} />
                  <span>Thêm Bộ phận</span>
                </button>
              </div>
            </div>

            {/* Banner Gợi ý Khởi tạo / Sao chép từ Mẫu chuẩn khi đơn vị chưa có bộ phận riêng */}
            {isSpecificUnitSelected && !hasUnitCustomDepartments && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
                  <AlertCircle size={16} className="shrink-0 text-amber-600" />
                  <span>
                    Đơn vị <strong>{donViMap.get(filterDonVi)?.ten_don_vi || filterDonVi}</strong> hiện chưa thiết lập danh mục Khối &amp; Thương hiệu riêng (đang dùng tạm mẫu chuẩn toàn quốc).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyTemplateForUnit(filterDonVi)}
                  disabled={submitting}
                  className="px-3 py-1.5 bg-[#D97706] hover:bg-[#b45309] text-white font-bold rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>⚡ Khởi tạo riêng từ Mẫu chuẩn</span>
                </button>
              </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-slate-700/80 text-gray-600 dark:text-gray-200 font-semibold border-b border-gray-200 dark:border-slate-600 z-10">
                  <tr>
                    <th className="p-3 w-16 text-center">Thứ tự</th>
                    <th className="p-3 w-48">Khối / Nghiệp vụ</th>
                    <th className="p-3 w-44">Mã TH / Phòng / Bộ phận</th>
                    <th className="p-3 min-w-[200px]">Thương hiệu / Phòng / Bộ phận</th>
                    <th className="p-3 w-48">Đơn vị áp dụng</th>
                    <th className="p-3 w-32 text-center">Trạng thái</th>
                    <th className="p-3 w-32 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-gray-700 dark:text-gray-300">
                  {filteredBoPhanList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        <Layers size={36} className="mx-auto mb-2 opacity-50 text-[#D97706]" />
                        <p className="font-semibold text-gray-600 dark:text-gray-300">Không tìm thấy Bộ phận phù hợp.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredBoPhanList.map((item) => {
                      // Badge màu theo từng Khối
                      let khoiBadgeStyle = 'bg-gray-100 text-gray-700 border-gray-200';
                      if (item.ma_cap1 === 'KD_XE') khoiBadgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                      else if (item.ma_cap1 === 'KD_DV') khoiBadgeStyle = 'bg-cyan-50 text-cyan-800 border-cyan-200';
                      else if (item.ma_cap1 === 'NVQT') khoiBadgeStyle = 'bg-purple-50 text-purple-800 border-purple-200';
                      else if (item.ma_cap1 === 'DUNG_CHUNG') khoiBadgeStyle = 'bg-orange-50 text-orange-800 border-orange-200';

                      return (
                        <tr key={item.id} className="hover:bg-amber-50/40 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="p-3 text-center font-mono font-bold text-gray-500">{item.thu_tu}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${khoiBadgeStyle}`}>
                              {item.ten_cap1}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-[#D97706]">{item.ma_cap2}</td>
                          <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">{item.ten_cap2}</td>
                          <td className="p-3">
                            {item.id_don_vi ? (
                              (() => {
                                const ids = String(item.id_don_vi).split(',').map(s => s.trim()).filter(Boolean);
                                if (ids.length === 1) {
                                  const u = donViMap.get(ids[0]);
                                  const name = u?.ten_don_vi || ids[0];
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 truncate max-w-[200px]"
                                      title={name}
                                    >
                                      <span>{getUnitEmoji(u?.loai_hinh)}</span>
                                      <span className="truncate">{name}</span>
                                    </span>
                                  );
                                }
                                const names = ids.map(id => donViMap.get(id)?.ten_don_vi || id).join(', ');
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-[#D97706] dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 cursor-help"
                                    title={names}
                                  >
                                    <Building2 size={12} />
                                    <span>{ids.length} đơn vị</span>
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600">
                                Mẫu chung toàn quốc
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {item.active !== false ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                <CheckCircle2 size={13} /> Hoạt động
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400">
                                <XCircle size={13} /> Tắt
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditBoPhan(item)}
                                className="p-1.5 text-[#D97706] hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteBoPhanTarget(item)}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                                title="Xóa"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== SUB-TAB 2: PHÁP NHÂN & SHOWROOM ===================== */}
        {activeSubTab === 'phapnhan' && (
          <div className="flex-1 overflow-auto custom-scrollbar p-4 space-y-4">
            {currentUnit ? (
              <div className="bg-amber-50/80 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200/80 text-xs text-amber-950 dark:text-amber-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="shrink-0 text-[#D97706]" />
                  <span>
                    Đang hiển thị các pháp nhân & showroom trực thuộc đơn vị: <strong>{currentUnit.ten_don_vi}</strong> ({filteredPhapNhanList.length} pháp nhân).
                  </span>
                </div>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                  Được lọc tự động theo Bộ lọc Đơn vị bên ngoài
                </span>
              </div>
            ) : (
              <div className="bg-amber-50/60 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200/70 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="shrink-0 text-amber-600" />
                  <span>
                    Đang hiển thị toàn bộ pháp nhân trong hệ thống ({phapNhanList.length} pháp nhân). Chọn đơn vị ở thanh bên trái để lọc nhanh theo chi nhánh.
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPhapNhanList.map(pn => {
                const assignedUnitIds = String(pn.id_don_vi || '').split(',').map(s => s.trim()).filter(Boolean);
                const assignedUnits = donViList.filter(u => assignedUnitIds.includes(String(u.id)));

                return (
                  <div
                    key={pn.id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/40 dark:bg-slate-700/30 hover:border-amber-300 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-[#D97706] dark:text-amber-400">
                          {pn.ten_cong_ty}
                        </h4>
                        <p className="text-xs font-mono text-gray-500">MST: {pn.ma_so_thue || 'Chưa có'}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-[#D97706] shrink-0">
                        {assignedUnits.length} showroom
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      <strong>Địa chỉ:</strong> {pn.dia_chi || 'Chưa cập nhật'}
                    </p>

                    <div className="pt-2 border-t border-gray-200/60 dark:border-slate-700">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        Showroom trực thuộc:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {assignedUnits.length > 0 ? (
                          assignedUnits.map(u => {
                            const isCurrentBranch = familyUnitIds ? familyUnitIds.has(String(u.id)) : true;
                            return (
                              <span
                                key={u.id}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border font-medium ${isCurrentBranch
                                  ? 'bg-amber-50 text-amber-900 border-amber-200 font-bold'
                                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200'
                                  }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isCurrentBranch ? 'bg-[#D97706]' : 'bg-emerald-500'}`} />
                                {u.ten_don_vi}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-gray-400 italic">Chưa liên kết Showroom nào</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL THÊM / SỬA BỘ PHẬN (KHỐI / NGHIỆP VỤ & THƯƠNG HIỆU / PHÒNG / BỘ PHẬN) */}
      {/* ========================================================================= */}
      {isBoPhanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-[#D97706]" />
                <span>{boPhanMode === 'create' ? 'Thêm Bộ phận Mới' : 'Cập nhật Bộ phận'}</span>
              </h3>
              <button
                onClick={() => setIsBoPhanModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBoPhan} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {/* Chọn Khối / Nghiệp vụ có sẵn hoặc tự nhập */}
              <div className="p-3 bg-amber-50/40 dark:bg-slate-700/30 rounded-xl border border-amber-100 dark:border-slate-600 space-y-3">
                <div className="text-xs font-bold text-[#D97706] uppercase tracking-wider">
                  Cấp 1: Khối / Nghiệp vụ
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Mã Khối / Nghiệp vụ *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: KD_XE, KD_DV, NVQT..."
                      value={boPhanForm.ma_cap1 || ''}
                      onChange={(e) => setBoPhanForm(p => ({ ...p, ma_cap1: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 text-xs font-mono font-bold border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 uppercase focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Tên Khối / Nghiệp vụ *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Kinh doanh xe, Nghiệp vụ Quản trị..."
                      value={boPhanForm.ten_cap1 || ''}
                      onChange={(e) => setBoPhanForm(p => ({ ...p, ten_cap1: e.target.value }))}
                      className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                    />
                  </div>
                </div>

                {/* Gợi ý chọn nhanh Khối có sẵn */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-gray-400">Gợi ý nhanh:</span>
                  {uniqueKhoiList.map(k => (
                    <button
                      key={k.ma}
                      type="button"
                      onClick={() => setBoPhanForm(p => ({ ...p, ma_cap1: k.ma, ten_cap1: k.ten }))}
                      className={`text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${boPhanForm.ma_cap1 === k.ma
                        ? 'bg-[#D97706] text-white border-[#D97706]'
                        : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-gray-200 hover:border-amber-400'
                        }`}
                    >
                      {k.ten}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thông tin Cấp 2: Thương hiệu / Phòng / Bộ phận */}
              <div className="p-3 bg-gray-50/50 dark:bg-slate-700/30 rounded-xl border border-gray-200 dark:border-slate-600 space-y-3">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Cấp 2: Thương hiệu / Phòng / Bộ phận (Phụ thuộc)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Mã Cấp 2 *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: KIA, MAZDA, QTVP, MKT, HR..."
                      value={boPhanForm.ma_cap2 || ''}
                      onChange={(e) => setBoPhanForm(p => ({ ...p, ma_cap2: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 text-xs font-mono font-bold border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 uppercase focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Tên Thương hiệu / Phòng ban *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Kia, Quản trị Văn phòng..."
                      value={boPhanForm.ten_cap2 || ''}
                      onChange={(e) => setBoPhanForm(p => ({ ...p, ten_cap2: e.target.value }))}
                      className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                    />
                  </div>
                </div>
              </div>

              {/* Đơn vị áp dụng (Chọn nhiều theo phân quyền và thể hiện dạng cây) */}
              <div className="p-3 bg-blue-50/30 dark:bg-slate-700/20 rounded-xl border border-blue-100 dark:border-slate-600 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={14} className="text-[#D97706]" />
                    <span>Đơn vị áp dụng ({selectedUnitIds.length} đã chọn) {!isGlobalAdmin && '*'}</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllUnits}
                      className="text-[11px] font-semibold text-[#D97706] hover:underline cursor-pointer"
                    >
                      Chọn tất cả
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={handleClearAllUnits}
                      className="text-[11px] font-semibold text-gray-500 hover:text-red-500 cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Tùy chọn Mẫu chung (chỉ dành cho Admin / Toàn quyền) */}
                {isGlobalAdmin && (
                  <label className="flex items-center gap-2 p-2 bg-amber-50/60 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/60 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedUnitIds.length === 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBoPhanForm(p => ({ ...p, id_don_vi: null }));
                        }
                      }}
                      className="rounded text-[#D97706] focus:ring-[#D97706] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      🌐 Áp dụng chung toàn hệ thống (Mẫu chuẩn)
                    </span>
                  </label>
                )}

                {/* Ô tìm kiếm đơn vị */}
                {allowedUnitsForDept.length > 5 && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                    <input
                      type="text"
                      placeholder="Tìm showroom / đơn vị trực thuộc..."
                      value={unitSearchQuery}
                      onChange={(e) => setUnitSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg outline-none focus:ring-1 focus:ring-[#D97706]"
                    />
                  </div>
                )}

                {/* Cây đơn vị phân quyền với checkbox */}
                <div className="max-h-52 overflow-y-auto p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 custom-scrollbar space-y-1">
                  {displayedTreeUnits.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400">
                      Không tìm thấy đơn vị phù hợp.
                    </div>
                  ) : (
                    displayedTreeUnits.map(({ unit, prefix }) => {
                      const isChecked = selectedUnitIds.includes(String(unit.id));
                      return (
                        <label
                          key={unit.id}
                          className={`flex items-center gap-2 p-1.5 rounded text-xs transition-colors cursor-pointer ${
                            isChecked
                              ? 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-semibold'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-700/60 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleUnit(String(unit.id))}
                            className="rounded text-[#D97706] focus:ring-[#D97706] w-3.5 h-3.5 cursor-pointer shrink-0"
                          />
                          <span className="font-mono text-gray-400 shrink-0 select-none text-[11px] whitespace-pre">
                            {prefix}
                          </span>
                          <span className="shrink-0">{getUnitEmoji(unit.loai_hinh)}</span>
                          <span className="truncate flex-1">{unit.ten_don_vi}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 font-normal px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">
                            {unit.loai_hinh}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Danh sách badge các đơn vị đã chọn */}
                {selectedUnitIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 max-h-20 overflow-y-auto custom-scrollbar">
                    {selectedUnitIds.map(uid => {
                      const u = donViMap.get(uid);
                      const name = u?.ten_don_vi || uid;
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 shrink-0"
                        >
                          <span>{getUnitEmoji(u?.loai_hinh)} {name}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleUnit(uid)}
                            className="text-amber-700 dark:text-amber-400 hover:text-red-600 rounded-full p-0.5 cursor-pointer"
                            title={`Bỏ chọn ${name}`}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <p className="text-[11px] text-gray-400 italic">
                  * Chọn một hoặc nhiều đơn vị trực thuộc theo phân quyền để áp dụng Bộ phận này.
                </p>
              </div>

              {/* Thứ tự & Trạng thái */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Thứ tự sắp xếp
                  </label>
                  <input
                    type="number"
                    value={boPhanForm.thu_tu ?? 1}
                    onChange={(e) => setBoPhanForm(p => ({ ...p, thu_tu: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs font-mono border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={boPhanForm.active !== false}
                      onChange={(e) => setBoPhanForm(p => ({ ...p, active: e.target.checked }))}
                      className="rounded text-[#D97706] focus:ring-[#D97706]"
                    />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Đang hoạt động</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBoPhanModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#D97706] hover:bg-[#b45309] text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  {submitting ? 'Đang lưu...' : (boPhanMode === 'create' ? 'Tạo mới' : 'Lưu cập nhật')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL XÁC NHẬN XÓA BỘ PHẬN */}
      {/* ========================================================================= */}
      {deleteBoPhanTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle size={24} />
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Xác nhận xóa Bộ phận?</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Bạn có chắc chắn muốn xóa bộ phận <strong>{deleteBoPhanTarget.ten_cap2}</strong> thuộc Khối <strong>{deleteBoPhanTarget.ten_cap1}</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteBoPhanTarget(null)}
                className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteBoPhan}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                {submitting ? 'Đang xóa...' : 'Xóa bộ phận'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
