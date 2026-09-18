import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, Edit, Trash2, Download, FileText, CheckCircle2,
  ArrowLeft, Save, CreditCard, Layers, RefreshCw, AlertTriangle,
  Eye, X, Lock, CheckSquare, Square, Sparkles, ChevronDown,
  Copy, FileEdit
} from 'lucide-react';
import {
  DNTT, DnttChiTiet, DnttPhanBo, DmKmp, DmBoPhan, BoPhanCap1,
  BoPhanCap2, PhapNhan, DonVi, ChiPhiChotKy
} from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../utils/toast';
import { numberToWordsVN } from '../../utils/numberToWordsVN';
import { getAllSubordinateIds, getUnitEmoji, sortDonViByThuTu, groupParentUnits, getUserPermittedUnitIds } from '../../utils/hierarchy';
import { THACO_AUTO_LOGO_BASE64 } from '../../assets/thacoAutoLogo';
import DnttAllocationModal from './DnttAllocationModal';
import { exportDnttToPdf } from './exportDnttPdf';
import PnModal from '../department/PnModal';

interface Props {
  dnttList: DNTT[];
  chiTietList: DnttChiTiet[];
  phanBoList: DnttPhanBo[];
  kmpList: DmKmp[];
  boPhanList?: DmBoPhan[];
  cap1List: BoPhanCap1[];
  cap2List: BoPhanCap2[];
  donViList: DonVi[];
  allDonViList?: DonVi[];
  phapNhanList: PhapNhan[];
  chotKyList?: ChiPhiChotKy[];
  selectedUnitFilter: string | null;
  onRefresh: () => Promise<void>;
  loading: boolean;
  externalSearchTerm?: string;
  createTrigger?: number;
}

export default function DnttTab({
  dnttList,
  chiTietList,
  phanBoList,
  kmpList,
  boPhanList,
  cap1List,
  cap2List,
  donViList,
  allDonViList,
  phapNhanList,
  chotKyList = [],
  selectedUnitFilter,
  onRefresh,
  loading,
  externalSearchTerm,
  createTrigger
}: Props) {
  const { user } = useAuth();

  // Mode hiển thị: 'list' (danh sách) hoặc 'form' (lập/sửa phiếu DNTT)
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [formMode, setFormMode] = useState<'create' | 'update'>('create');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal thêm Pháp nhân nhanh
  const [pnModalOpen, setPnModalOpen] = useState(false);

  // Trạng thái chọn đơn vị trực thuộc dạng cây hoặc nhập tay (Khác)
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const unitDropdownRef = useRef<HTMLDivElement>(null);

  // Menu tùy chọn Lưu: 1. Lưu nháp / 2. Lưu và ghi nhận chi phí
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown cây đơn vị và menu Lưu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target as Node)) {
        setUnitDropdownOpen(false);
      }
      if (saveMenuRef.current && !saveMenuRef.current.contains(event.target as Node)) {
        setShowSaveMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Đồng bộ từ khóa tìm kiếm từ Header chính của module
  useEffect(() => {
    if (externalSearchTerm !== undefined) {
      setSearchTerm(externalSearchTerm);
    }
  }, [externalSearchTerm]);

  // Kích hoạt tạo mới phiếu DNTT từ Header chính
  useEffect(() => {
    if (createTrigger && createTrigger > 0) {
      handleStartCreateNew();
    }
  }, [createTrigger]);

  // Current DNTT Form State
  const [currentDntt, setCurrentDntt] = useState<Partial<DNTT>>({
    id: '',
    so_dntt: '',
    ngay_lap: new Date().toISOString().split('T')[0],
    id_phap_nhan: '',
    id_don_vi: '',
    nguoi_de_nghi: user?.ho_ten || user?.username || '',
    bo_phan_hien_thi: 'QTPV, AS & MTLV',
    don_vi_hien_thi: '',
    noi_dung_thanh_toan: '',
    tong_so_tien: 0,
    so_tien_bang_chu: '',
    hinh_thuc_thanh_toan: 'Chuyển khoản',
    ten_tai_khoan: '',
    so_tai_khoan: '',
    ten_ngan_hang: '',
    chi_nhanh_ngan_hang: '',
    trang_thai: 'Đã lưu',
    hien_thi_phan_bo: true,
    hien_thi_hoa_don: true,
    so_hoa_don: '',
    ngay_hoa_don: '',
    noi_dung_chuyen_khoan: '',
    ghi_chu: '',
    hien_thi_nd_ck: true,
    hien_thi_ghi_chu: true,
    ky_chuc_danh_1: 'Phê duyệt',
    ky_chuc_danh_2: 'Kế toán - Tài chính',
    ky_chuc_danh_3: 'Trưởng bộ phận',
    ky_chuc_danh_4: 'Người đề nghị',
    ky_ho_ten_1: '',
    ky_ho_ten_2: '',
    ky_ho_ten_3: '',
    ky_ho_ten_4: user?.ho_ten || user?.username || ''
  });

  // Dòng nội dung thanh toán (STT | Nội dung | Số tiền)
  const [items, setItems] = useState<DnttChiTiet[]>([]);

  // Bản đồ phân bổ: itemId -> DnttPhanBo[]
  const [allocationsMap, setAllocationsMap] = useState<Record<string, DnttPhanBo[]>>({});

  // Allocation modal state
  const [allocatingItem, setAllocatingItem] = useState<DnttChiTiet | null>(null);

  // Preview Trang 2 (Bảng kê phân bổ chi phí đính kèm)
  const [previewBangKeOpen, setPreviewBangKeOpen] = useState(false);

  // Saving / Submitting
  const [submitting, setSubmitting] = useState(false);
  const [deleteTargetDntt, setDeleteTargetDntt] = useState<DNTT | null>(null);

  // Bulk selection & Batch Delete
  const [selectedDnttIds, setSelectedDnttIds] = useState<Set<string>>(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Kiểm tra phiếu có bị khóa hay không (toàn bộ phiếu luôn được tự do sửa đổi và cập nhật live)
  const isDnttLocked = (_d?: DNTT | Partial<DNTT> | null) => false;

  // =========================================================================
  // 1. XÁC ĐỊNH ĐƠN VỊ & GIA ĐÌNH ĐƠN VỊ ĐƯỢC CHỌN BÊN NGOÀI
  // =========================================================================
  const fullDonViList = useMemo(() => (allDonViList && allDonViList.length > 0 ? allDonViList : donViList), [allDonViList, donViList]);

  // Phạm vi phân quyền đơn vị của người dùng (Đơn vị mẹ + các đơn vị trực thuộc)
  const userPermittedUnitIds = useMemo(() => {
    return getUserPermittedUnitIds(user, fullDonViList);
  }, [user, fullDonViList]);

  const currentUnit = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') {
      if (userPermittedUnitIds) {
        const userUnit = fullDonViList.find(d => String(d.id) === String(user?.id_don_vi));
        if (userUnit) return userUnit;
        const permitted = fullDonViList.find(d => userPermittedUnitIds.has(String(d.id)));
        if (permitted) return permitted;
      }
      return fullDonViList.length > 0 ? fullDonViList[0] : null;
    }
    return fullDonViList.find(d => String(d.id) === String(selectedUnitFilter)) || null;
  }, [selectedUnitFilter, fullDonViList, userPermittedUnitIds, user?.id_don_vi]);

  // Helper lấy tên hiển thị chuẩn: "Showroom Cao Lãnh - THACO AUTO Đồng Tháp"
  const getUnitDisplayName = (unit: DonVi | null | undefined): string => {
    if (!unit) return '';
    if (unit.cap_quan_ly && unit.cap_quan_ly !== 'HO' && unit.cap_quan_ly !== 'DV_HO') {
      const parent = fullDonViList.find(u => String(u.id) === String(unit.cap_quan_ly));
      if (parent && parent.ten_don_vi !== unit.ten_don_vi) {
        return `${unit.ten_don_vi} - ${parent.ten_don_vi}`;
      }
    }
    return unit.ten_don_vi;
  };

  // Kiểm tra đơn vị có phải là Đại lý hay không (để loại trừ theo yêu cầu)
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

  // Danh sách đơn vị trực thuộc hợp lệ (loại trừ hoàn toàn Đại lý và giới hạn theo phân quyền người dùng)
  const nonAgencyUnits = useMemo(() => {
    const list = fullDonViList.filter(u => !isDonViDaiLy(u));
    if (userPermittedUnitIds) {
      return list.filter(u => userPermittedUnitIds.has(String(u.id)));
    }
    return list;
  }, [fullDonViList, userPermittedUnitIds]);

  // Danh sách các đơn vị có thể chọn làm Đơn vị thực hiện chi phí trên Giấy DNTT (không gồm đại lý)
  const selectableUnits = useMemo(() => {
    if (!currentUnit || !selectedUnitFilter || selectedUnitFilter === 'ALL') {
      return nonAgencyUnits;
    }

    // Tìm đơn vị mẹ cấp CTTT / VPĐH (root)
    let rootUnit = currentUnit;
    if (rootUnit.cap_quan_ly && rootUnit.cap_quan_ly !== 'HO' && rootUnit.cap_quan_ly !== 'DV_HO') {
      const parent = nonAgencyUnits.find(u => String(u.id) === String(rootUnit.cap_quan_ly));
      if (parent) rootUnit = parent;
    }

    // Lấy rootUnit và tất cả các đơn vị con (Showroom) trực thuộc
    const subIds = new Set(getAllSubordinateIds(rootUnit.id, nonAgencyUnits));
    const list = nonAgencyUnits.filter(u => String(u.id) === String(rootUnit.id) || subIds.has(String(u.id)));
    return list.length > 0 ? list : [currentUnit];
  }, [currentUnit, selectedUnitFilter, nonAgencyUnits]);

  // Danh sách các đơn vị dạng cây phân cấp (loại trừ Đại lý) để hiển thị trong popover chọn
  const treeUnits = useMemo(() => {
    const validUnitIds = new Set(nonAgencyUnits.map(u => String(u.id)));

    // Nếu đang chọn 1 đơn vị cụ thể (CTTT hoặc Showroom)
    if (selectedUnitFilter && selectedUnitFilter !== 'ALL') {
      let rootUnit = nonAgencyUnits.find(u => String(u.id) === String(selectedUnitFilter));
      if (rootUnit?.cap_quan_ly && rootUnit.cap_quan_ly !== 'HO' && rootUnit.cap_quan_ly !== 'DV_HO') {
        const p = nonAgencyUnits.find(u => String(u.id) === String(rootUnit?.cap_quan_ly));
        if (p) rootUnit = p;
      }

      if (rootUnit) {
        const children = sortDonViByThuTu(nonAgencyUnits.filter(u => String(u.cap_quan_ly) === String(rootUnit.id)));
        const items: {
          unit: DonVi;
          depth: number;
          isLast: boolean;
          displayName: string;
          emoji: string;
        }[] = [
            {
              unit: rootUnit,
              depth: 0,
              isLast: children.length === 0,
              displayName: rootUnit.ten_don_vi,
              emoji: getUnitEmoji(rootUnit.loai_hinh)
            }
          ];

        children.forEach((child, idx) => {
          items.push({
            unit: child,
            depth: 1,
            isLast: idx === children.length - 1,
            displayName: getUnitDisplayName(child),
            emoji: getUnitEmoji(child.loai_hinh)
          });
        });

        return items;
      }
    }

    // Nếu là 'ALL': xây dựng toàn bộ cây đơn vị toàn quốc
    const rawRoots = nonAgencyUnits.filter(u => !u.cap_quan_ly || u.cap_quan_ly === 'HO' || !validUnitIds.has(String(u.cap_quan_ly)));
    const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = groupParentUnits(rawRoots);
    const sortedRoots = [...vpdhUnits, ...ctttNamUnits, ...ctttBacUnits, ...otherUnits];

    const items: {
      unit: DonVi;
      depth: number;
      isLast: boolean;
      displayName: string;
      emoji: string;
    }[] = [];

    sortedRoots.forEach(root => {
      const children = sortDonViByThuTu(nonAgencyUnits.filter(u => String(u.cap_quan_ly) === String(root.id)));
      items.push({
        unit: root,
        depth: 0,
        isLast: children.length === 0,
        displayName: root.ten_don_vi,
        emoji: getUnitEmoji(root.loai_hinh)
      });

      children.forEach((child, idx) => {
        items.push({
          unit: child,
          depth: 1,
          isLast: idx === children.length - 1,
          displayName: getUnitDisplayName(child),
          emoji: getUnitEmoji(child.loai_hinh)
        });
      });
    });

    return items;
  }, [nonAgencyUnits, selectedUnitFilter]);

  // Tập hợp tất cả các ID đơn vị thuộc cùng gia đình (đơn vị đang chọn + cấp dưới + cấp trên)
  const familyUnitIds = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') return null;

    // Lấy toàn bộ đơn vị cấp dưới trực tiếp và gián tiếp
    const subIds = getAllSubordinateIds(selectedUnitFilter, fullDonViList);

    // Lấy các đơn vị cấp trên (bỏ qua 'HO' và 'DV_HO')
    const ancestors: string[] = [];
    let curr = fullDonViList.find(u => String(u.id) === String(selectedUnitFilter));
    const visited = new Set<string>();
    while (curr && curr.cap_quan_ly && curr.cap_quan_ly !== 'HO' && curr.cap_quan_ly !== 'DV_HO' && !visited.has(curr.cap_quan_ly)) {
      visited.add(curr.cap_quan_ly);
      ancestors.push(curr.cap_quan_ly);
      curr = fullDonViList.find(u => String(u.id) === String(curr?.cap_quan_ly));
    }

    return new Set([selectedUnitFilter, ...subIds, ...ancestors]);
  }, [selectedUnitFilter, fullDonViList]);

  // =========================================================================
  // 2. LỌC PHÁP NHÂN CHỈ THUỘC ĐƠN VỊ ĐANG CHỌN (VD: THACO AUTO ĐỒNG THÁP)
  // =========================================================================
  const availablePhapNhanList = useMemo(() => {
    if (!familyUnitIds) return phapNhanList;

    // Lọc theo id_don_vi liên kết trong dm_phap_nhan
    const matched = phapNhanList.filter(pn => {
      if (!pn.id_don_vi) return false;
      const uIds = String(pn.id_don_vi).split(',').map(s => s.trim());
      return uIds.some(uid => familyUnitIds.has(uid));
    });

    if (matched.length > 0) return matched;

    // Fallback: nếu chưa cấu hình id_don_vi, tìm theo từ khóa tên tỉnh thành
    if (currentUnit?.ten_don_vi) {
      const cleanName = currentUnit.ten_don_vi.toLowerCase().replace('thaco auto', '').trim();
      const words = cleanName.split(' ').filter(w => w.length > 2);
      const nameMatched = phapNhanList.filter(pn => {
        const pnName = (pn.ten_cong_ty || pn.ten_phap_nhan || '').toLowerCase();
        return words.some(w => pnName.includes(w));
      });
      if (nameMatched.length > 0) return nameMatched;
    }

    return phapNhanList;
  }, [familyUnitIds, phapNhanList, currentUnit]);

  // Pháp nhân mặc định tương ứng với đơn vị đang chọn
  const defaultPhapNhan = useMemo(() => {
    return availablePhapNhanList[0] || phapNhanList[0] || null;
  }, [availablePhapNhanList, phapNhanList]);

  // ID Pháp nhân đang chọn trên form
  const [selectedPnId, setSelectedPnId] = useState<string>('');

  useEffect(() => {
    if (defaultPhapNhan) {
      setSelectedPnId(defaultPhapNhan.id);
    }
  }, [defaultPhapNhan]);

  const activePhapNhan = useMemo(() => {
    return availablePhapNhanList.find(p => p.id === selectedPnId) || defaultPhapNhan;
  }, [selectedPnId, availablePhapNhanList, defaultPhapNhan]);

  // =========================================================================
  // CƠ CHẾ GHI NHỚ NGƯỜI PHÊ DUYỆT THEO PHÁP NHÂN (APPROVER MEMORY MECHANISM)
  // =========================================================================
  const STORAGE_KEY_APPROVER = 'THACO_DNTT_APPROVER_CACHE';

  // Tự động suy luận hoặc trích xuất địa danh chuẩn cho Pháp nhân / Showroom
  const resolveLocationForPhapNhan = (pnId?: string): string => {
    // 1. Tra cứu xem có bất kỳ phiếu DNTT nào trong pháp nhân này đã từng có dia_diem_ky
    if (pnId) {
      const matchWithLoc = dnttList
        .filter(d => String(d.id_phap_nhan) === String(pnId) && d.dia_diem_ky && d.dia_diem_ky.trim() !== '')
        .sort((a, b) => new Date(b.created_at || b.ngay_lap || 0).getTime() - new Date(a.created_at || a.ngay_lap || 0).getTime());
      if (matchWithLoc.length > 0 && matchWithLoc[0].dia_diem_ky) {
        return matchWithLoc[0].dia_diem_ky.trim();
      }
    }

    // 2. Tra cứu theo đơn vị hiện tại (nếu có phiếu cùng đơn vị)
    if (currentUnit?.id) {
      const matchUnitWithLoc = dnttList
        .filter(d => String(d.id_don_vi) === String(currentUnit.id) && d.dia_diem_ky && d.dia_diem_ky.trim() !== '')
        .sort((a, b) => new Date(b.created_at || b.ngay_lap || 0).getTime() - new Date(a.created_at || a.ngay_lap || 0).getTime());
      if (matchUnitWithLoc.length > 0 && matchUnitWithLoc[0].dia_diem_ky) {
        return matchUnitWithLoc[0].dia_diem_ky.trim();
      }
    }

    // 3. Tách từ địa chỉ pháp nhân (ví dụ: "... xã Châu Thành, tỉnh Đồng Tháp" -> "Đồng Tháp")
    const targetPn = phapNhanList.find(p => p.id === pnId) || activePhapNhan;
    if (targetPn?.dia_chi) {
      const provinceMatch = targetPn.dia_chi.match(/(?:tỉnh|thành phố|tp\.?)\s+([^,]+)/i);
      if (provinceMatch && provinceMatch[1]) {
        return provinceMatch[1].trim();
      }
    }

    // 4. Tách từ tên công ty pháp nhân (ví dụ: "CÔNG TY TNHH THACO AUTO ĐỒNG THÁP" -> "Đồng Tháp")
    if (targetPn?.ten_cong_ty || targetPn?.ten_phap_nhan) {
      const name = targetPn.ten_cong_ty || targetPn.ten_phap_nhan || '';
      const thacoMatch = name.match(/THACO AUTO\s+(.+)$/i);
      if (thacoMatch && thacoMatch[1]) {
        const raw = thacoMatch[1].trim();
        return raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }

    // 5. Tách từ tên đơn vị đang chọn (ví dụ: "Showroom Mỹ Tho - THACO AUTO Đồng Tháp" hoặc "THACO AUTO Đồng Tháp")
    if (currentUnit?.ten_don_vi) {
      const thacoMatch = currentUnit.ten_don_vi.match(/THACO AUTO\s+(.+)$/i);
      if (thacoMatch && thacoMatch[1]) {
        return thacoMatch[1].trim();
      }
      const clean = currentUnit.ten_don_vi.replace(/^(Showroom|Đại lý|Văn phòng|Chi nhánh)\s*/i, '').trim();
      if (clean) return clean;
    }

    return '';
  };

  // Lấy dữ liệu cache từ localStorage
  const getApproverMemoryFromStorage = (pnId?: string) => {
    if (!pnId) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_APPROVER);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data[pnId] || null;
    } catch {
      return null;
    }
  };

  // Lưu thông tin người phê duyệt & địa điểm ký vào localStorage theo từng pháp nhân
  const saveApproverMemoryToStorage = (pnId: string, item: {
    ky_chuc_danh_1?: string;
    ky_ho_ten_1?: string;
    ky_chuc_danh_2?: string;
    ky_ho_ten_2?: string;
    ky_chuc_danh_3?: string;
    ky_ho_ten_3?: string;
    dia_diem_ky?: string;
  }) => {
    if (!pnId) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_APPROVER);
      const data = raw ? JSON.parse(raw) : {};
      data[pnId] = {
        ...data[pnId],
        ...item,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY_APPROVER, JSON.stringify(data));
    } catch (err) {
      console.error('Lỗi khi lưu bộ nhớ người phê duyệt:', err);
    }
  };

  // Tìm kiếm thông tin người phê duyệt & địa điểm ký gần nhất (ưu tiên localStorage -> fallback dnttList)
  const getApproverMemory = (pnId?: string) => {
    const defaultLocation = resolveLocationForPhapNhan(pnId);

    if (!pnId) {
      return {
        ky_chuc_danh_1: 'Phê duyệt',
        ky_ho_ten_1: '',
        ky_chuc_danh_2: 'Kế toán - Tài chính',
        ky_ho_ten_2: '',
        ky_chuc_danh_3: 'Trưởng bộ phận',
        ky_ho_ten_3: '',
        dia_diem_ky: defaultLocation
      };
    }

    // 1. Kiểm tra cache localStorage của máy trước
    const cached = getApproverMemoryFromStorage(pnId);
    if (cached && (cached.ky_ho_ten_1 || cached.ky_ho_ten_2 || cached.ky_ho_ten_3 || cached.dia_diem_ky)) {
      return {
        ky_chuc_danh_1: cached.ky_chuc_danh_1 || 'Phê duyệt',
        ky_ho_ten_1: cached.ky_ho_ten_1 || '',
        ky_chuc_danh_2: cached.ky_chuc_danh_2 || 'Kế toán - Tài chính',
        ky_ho_ten_2: cached.ky_ho_ten_2 || '',
        ky_chuc_danh_3: cached.ky_chuc_danh_3 || 'Trưởng bộ phận',
        ky_ho_ten_3: cached.ky_ho_ten_3 || '',
        dia_diem_ky: cached.dia_diem_ky || defaultLocation
      };
    }

    // 2. Tra cứu trong dnttList phiếu gần nhất của pháp nhân này có chữ ký hoặc địa điểm ký
    const matchingDntt = dnttList
      .filter(d => String(d.id_phap_nhan) === String(pnId) && (d.ky_ho_ten_1 || d.ky_ho_ten_2 || d.ky_ho_ten_3 || d.dia_diem_ky))
      .sort((a, b) => {
        const timeA = new Date(a.created_at || a.ngay_lap || 0).getTime();
        const timeB = new Date(b.created_at || b.ngay_lap || 0).getTime();
        return timeB - timeA;
      });

    if (matchingDntt.length > 0) {
      const latest = matchingDntt[0];
      return {
        ky_chuc_danh_1: latest.ky_chuc_danh_1 || 'Phê duyệt',
        ky_ho_ten_1: latest.ky_ho_ten_1 || '',
        ky_chuc_danh_2: latest.ky_chuc_danh_2 || 'Kế toán - Tài chính',
        ky_ho_ten_2: latest.ky_ho_ten_2 || '',
        ky_chuc_danh_3: latest.ky_chuc_danh_3 || 'Trưởng bộ phận',
        ky_ho_ten_3: latest.ky_ho_ten_3 || '',
        dia_diem_ky: latest.dia_diem_ky || defaultLocation
      };
    }

    return {
      ky_chuc_danh_1: 'Phê duyệt',
      ky_ho_ten_1: '',
      ky_chuc_danh_2: 'Kế toán - Tài chính',
      ky_ho_ten_2: '',
      ky_chuc_danh_3: 'Trưởng bộ phận',
      ky_ho_ten_3: '',
      dia_diem_ky: defaultLocation
    };
  };

  // Danh sách các chức vụ, họ tên và địa điểm ký gợi ý (Autocomplete datalist) trong cùng pháp nhân
  const approverSuggestions = useMemo(() => {
    const pnId = activePhapNhan?.id;
    if (!pnId) {
      return {
        names1: [], titles1: [],
        names2: [], titles2: [],
        names3: [], titles3: [],
        locations: []
      };
    }

    const pDntt = dnttList.filter(d => String(d.id_phap_nhan) === String(pnId));
    const cached = getApproverMemoryFromStorage(pnId);

    const collect = (accessor: (d: any) => string | undefined, defaultVal?: string) => {
      const set = new Set<string>();
      if (defaultVal) set.add(defaultVal);
      if (cached) {
        const v = accessor(cached);
        if (v && v.trim()) set.add(v.trim());
      }
      pDntt.forEach(d => {
        const v = accessor(d);
        if (v && v.trim()) set.add(v.trim());
      });
      return Array.from(set);
    };

    const locSet = new Set<string>(collect(d => d.dia_diem_ky));
    const autoLoc = resolveLocationForPhapNhan(pnId);
    if (autoLoc) locSet.add(autoLoc);

    return {
      names1: collect(d => d.ky_ho_ten_1),
      titles1: collect(d => d.ky_chuc_danh_1, 'Phê duyệt'),
      names2: collect(d => d.ky_ho_ten_2),
      titles2: collect(d => d.ky_chuc_danh_2, 'Kế toán - Tài chính'),
      names3: collect(d => d.ky_ho_ten_3),
      titles3: collect(d => d.ky_chuc_danh_3, 'Trưởng bộ phận'),
      locations: Array.from(locSet)
    };
  }, [activePhapNhan, dnttList, currentUnit]);

  // Hành động chủ động áp dụng thông tin người duyệt & địa điểm ký từ phiếu trước của pháp nhân này
  const handleApplyPreviousApprovers = () => {
    const pnId = activePhapNhan?.id;
    if (!pnId) {
      toast.warning('Chưa xác định được Pháp nhân để lấy thông tin!');
      return;
    }
    const mem = getApproverMemory(pnId);
    const loc = mem.dia_diem_ky || resolveLocationForPhapNhan(pnId) || '';

    if (!mem.ky_ho_ten_1 && !mem.ky_ho_ten_2 && !mem.ky_ho_ten_3 && !loc) {
      toast.info('Chưa có dữ liệu người phê duyệt hoặc địa điểm ký của pháp nhân này.');
      return;
    }

    setCurrentDntt(prev => ({
      ...prev,
      ky_chuc_danh_1: mem.ky_chuc_danh_1 || prev.ky_chuc_danh_1,
      ky_ho_ten_1: mem.ky_ho_ten_1 || prev.ky_ho_ten_1,
      ky_chuc_danh_2: mem.ky_chuc_danh_2 || prev.ky_chuc_danh_2,
      ky_ho_ten_2: mem.ky_ho_ten_2 || prev.ky_ho_ten_2,
      ky_chuc_danh_3: mem.ky_chuc_danh_3 || prev.ky_chuc_danh_3,
      ky_ho_ten_3: mem.ky_ho_ten_3 || prev.ky_ho_ten_3,
      dia_diem_ky: loc || prev.dia_diem_ky || ''
    }));

    const detailsMsg = [
      mem.ky_ho_ten_1 ? `Phê duyệt: ${mem.ky_ho_ten_1}` : null,
      loc ? `Địa điểm: ${loc}` : null
    ].filter(Boolean).join(' | ');

    toast.success(`Đã lấy thông tin người duyệt & địa điểm (${detailsMsg || activePhapNhan?.ten_cong_ty || 'pháp nhân'})!`);
  };

  // Định dạng tên đơn vị hiển thị chuẩn mẫu (VD: Showroom Mỹ Tho - THACO AUTO Đồng Tháp)
  const defaultDonViDisplay = useMemo(() => {
    return getUnitDisplayName(currentUnit) || 'Showroom Mỹ Tho - THACO AUTO Đồng Tháp';
  }, [currentUnit, fullDonViList]);

  // Tự động tính tổng tiền từ bảng chi tiết
  const calculatedTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.so_tien) || 0), 0);
  }, [items]);

  // Tự động sinh số tiền bằng chữ khi tổng tiền thay đổi
  const textAmount = useMemo(() => {
    return numberToWordsVN(calculatedTotal);
  }, [calculatedTotal]);

  // Kiểm tra tình trạng phân bổ của tất cả các dòng
  const allocationStatus = useMemo(() => {
    if (items.length === 0) return { allMatched: false, details: [] };

    const details = items.map(item => {
      const itemAllocations = allocationsMap[item.id] || [];
      const totalItemAlloc = itemAllocations.reduce((s, a) => s + (Number(a.so_tien) || 0), 0);
      const diff = Number(item.so_tien) - totalItemAlloc;
      const matched = itemAllocations.length > 0 && Math.abs(diff) === 0;
      return {
        itemId: item.id,
        itemAmount: Number(item.so_tien),
        allocatedAmount: totalItemAlloc,
        diff,
        matched,
        count: itemAllocations.length
      };
    });

    const allMatched = details.length > 0 && details.every(d => d.matched);
    return { allMatched, details };
  }, [items, allocationsMap]);

  // Map danh mục bộ phận & cấp 1 & cấp 2 (gọi ở đầu component tuân thủ tuyệt đối Rules of Hooks)
  const boPhanMap = useMemo(() => new Map((boPhanList || []).map(b => [b.id, b])), [boPhanList]);
  const cap1Map = useMemo(() => new Map(cap1List.map(c => [c.id, c.ten])), [cap1List]);
  const cap2Map = useMemo(() => new Map(cap2List.map(c => [c.id, c.ten])), [cap2List]);
  const kmpMap = useMemo(() => new Map(kmpList.map(k => [k.id, k])), [kmpList]);

  // Mở Form tạo DNTT mới
  const handleStartCreateNew = () => {
    const defaultDnttId = `DNTT_${Date.now()}`;
    const defaultItemId = `CT_${Date.now()}_1`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const targetPnId = defaultPhapNhan?.id || selectedPnId || '';
    const memApprovers = getApproverMemory(targetPnId);

    const initialUnit = currentUnit || selectableUnits[0] || null;
    const initialUnitDisplay = getUnitDisplayName(initialUnit) || defaultDonViDisplay;

    setCurrentDntt({
      id: defaultDnttId,
      so_dntt: `DNTT-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      ngay_lap: dateStr,
      id_phap_nhan: targetPnId,
      id_don_vi: initialUnit?.id || '',
      nguoi_de_nghi: user?.ho_ten || user?.username || '',
      bo_phan_hien_thi: 'QTPV, AS & MTLV',
      don_vi_hien_thi: initialUnitDisplay,
      noi_dung_thanh_toan: '',
      tong_so_tien: 0,
      so_tien_bang_chu: '',
      hinh_thuc_thanh_toan: 'Chuyển khoản',
      ten_tai_khoan: '',
      so_tai_khoan: '',
      ten_ngan_hang: '',
      chi_nhanh_ngan_hang: '',
      trang_thai: 'Đã lưu',
      hien_thi_phan_bo: true,
      hien_thi_hoa_don: true,
      so_hoa_don: '',
      ngay_hoa_don: '',
      noi_dung_chuyen_khoan: '',
      ghi_chu: '',
      hien_thi_nd_ck: true,
      hien_thi_ghi_chu: true,
      ky_chuc_danh_1: memApprovers.ky_chuc_danh_1 || 'Phê duyệt',
      ky_chuc_danh_2: memApprovers.ky_chuc_danh_2 || 'Kế toán - Tài chính',
      ky_chuc_danh_3: memApprovers.ky_chuc_danh_3 || 'Trưởng bộ phận',
      ky_chuc_danh_4: 'Người đề nghị',
      ky_ho_ten_1: memApprovers.ky_ho_ten_1 || '',
      ky_ho_ten_2: memApprovers.ky_ho_ten_2 || '',
      ky_ho_ten_3: memApprovers.ky_ho_ten_3 || '',
      ky_ho_ten_4: user?.ho_ten || user?.username || '',
      dia_diem_ky: memApprovers.dia_diem_ky || resolveLocationForPhapNhan(targetPnId) || ''
    });

    const initialItem: DnttChiTiet = {
      id: defaultItemId,
      dntt_id: defaultDnttId,
      stt: 1,
      noi_dung: '',
      so_tien: 0
    };

    setItems([initialItem]);
    setAllocationsMap({
      [defaultItemId]: []
    });

    setIsCustomUnit(false);
    setUnitDropdownOpen(false);
    setFormMode('create');
    setViewMode('form');
  };

  // Mở form sửa DNTT cũ (hỗ trợ truyền trực tiếp danh sách chi tiết & phân bổ nếu có)
  const handleOpenEditDntt = (dntt: DNTT, overrideDetails?: DnttChiTiet[], overridePhanBo?: DnttPhanBo[]) => {
    // Tự động nhận diện đơn vị / Showroom:
    let resolvedUnitId = dntt.id_don_vi || currentUnit?.id || '';
    if (!dntt.id_don_vi && dntt.don_vi_hien_thi) {
      const lower = dntt.don_vi_hien_thi.toLowerCase().trim();
      const matchedSub = selectableUnits.find(u => {
        const uName = (u.ten_don_vi || '').toLowerCase().trim();
        return uName && (lower === uName || lower === `thaco auto - ${uName}` || lower === `thaco auto ${uName}`);
      });
      if (matchedSub) {
        resolvedUnitId = matchedSub.id;
      }
    }

    const unitObj = fullDonViList.find(u => String(u.id) === String(resolvedUnitId));
    const unitDisplay = dntt.don_vi_hien_thi || getUnitDisplayName(unitObj) || defaultDonViDisplay;

    // Kiểm tra xem đơn vị này là đơn vị chuẩn trong hệ thống hay được tự gõ tay
    const isStandard = nonAgencyUnits.some(u =>
      String(u.id) === String(resolvedUnitId) ||
      (dntt.don_vi_hien_thi && (u.ten_don_vi.toLowerCase() === dntt.don_vi_hien_thi.toLowerCase() || getUnitDisplayName(u).toLowerCase() === dntt.don_vi_hien_thi.toLowerCase()))
    );
    setIsCustomUnit(!isStandard && !!dntt.don_vi_hien_thi && !dntt.id_don_vi);
    setUnitDropdownOpen(false);

    setCurrentDntt({
      ...dntt,
      id_don_vi: resolvedUnitId,
      don_vi_hien_thi: unitDisplay,
      hien_thi_phan_bo: dntt.hien_thi_phan_bo !== false,
      hien_thi_hoa_don: dntt.hien_thi_hoa_don !== false,
      so_hoa_don: dntt.so_hoa_don || '',
      ngay_hoa_don: dntt.ngay_hoa_don || '',
      noi_dung_chuyen_khoan: dntt.noi_dung_chuyen_khoan || '',
      ghi_chu: dntt.ghi_chu || '',
      hien_thi_nd_ck: dntt.hien_thi_nd_ck !== false,
      hien_thi_ghi_chu: dntt.hien_thi_ghi_chu !== false,
      ky_chuc_danh_1: dntt.ky_chuc_danh_1 || 'Phê duyệt',
      ky_chuc_danh_2: dntt.ky_chuc_danh_2 || 'Kế toán - Tài chính',
      ky_chuc_danh_3: dntt.ky_chuc_danh_3 || 'Trưởng bộ phận',
      ky_chuc_danh_4: dntt.ky_chuc_danh_4 || 'Người đề nghị',
      ky_ho_ten_1: dntt.ky_ho_ten_1 || '',
      ky_ho_ten_2: dntt.ky_ho_ten_2 || '',
      ky_ho_ten_3: dntt.ky_ho_ten_3 || '',
      ky_ho_ten_4: dntt.ky_ho_ten_4 !== undefined ? dntt.ky_ho_ten_4 : (dntt.nguoi_de_nghi || '')
    });
    if (dntt.id_phap_nhan) setSelectedPnId(dntt.id_phap_nhan);

    // Lọc các dòng chi tiết thuộc dntt này
    const matchingDetails = (overrideDetails || chiTietList)
      .filter(ct => ct.dntt_id === dntt.id)
      .sort((a, b) => (a.stt || 0) - (b.stt || 0));

    // Lọc các dòng phân bổ thuộc dntt này
    const matchingPhanBo = (overridePhanBo || phanBoList).filter(pb => pb.dntt_id === dntt.id);
    const newAllocMap: Record<string, DnttPhanBo[]> = {};

    matchingDetails.forEach(item => {
      newAllocMap[item.id] = matchingPhanBo.filter(pb => pb.dntt_chi_tiet_id === item.id);
    });

    setItems(matchingDetails.length > 0 ? matchingDetails : [
      { id: `CT_${Date.now()}_1`, dntt_id: dntt.id, stt: 1, noi_dung: dntt.noi_dung_thanh_toan || '', so_tien: dntt.tong_so_tien }
    ]);
    setAllocationsMap(newAllocMap);
    setFormMode('update');
    setViewMode('form');
  };

  // Thao tác nhân đôi đề nghị thanh toán (Duplicate)
  const handleDuplicateDntt = async (sourceDntt: DNTT) => {
    try {
      setSubmitting(true);
      toast.info('Đang nhân đôi Đề nghị thanh toán...');

      const newDnttId = `DNTT_${Date.now()}`;
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const dayStr = String(today.getDate()).padStart(2, '0');
      const monthStr = String(today.getMonth() + 1).padStart(2, '0');
      const yearStr = String(today.getFullYear());

      // 1. Tạo Header mới ở trạng thái Lưu nháp
      const newDntt: DNTT = {
        ...sourceDntt,
        id: newDnttId,
        so_dntt: '', // Để trống cho phiếu mới
        ngay_lap: todayStr,
        ngay_ky_ngay: dayStr,
        ngay_ky_thang: monthStr,
        ngay_ky_nam: yearStr,
        trang_thai: 'Lưu nháp',
        updated_at: today.toISOString()
      };

      // 2. Nhân đôi danh sách chi tiết chi phí
      const matchingDetails = chiTietList
        .filter(ct => ct.dntt_id === sourceDntt.id)
        .sort((a, b) => (a.stt || 0) - (b.stt || 0));

      const idMap = new Map<string, string>(); // oldCtId -> newCtId
      const newChiTietList: DnttChiTiet[] = matchingDetails.map((ct, idx) => {
        const newCtId = `CT_${Date.now()}_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`;
        idMap.set(ct.id, newCtId);
        return {
          ...ct,
          id: newCtId,
          dntt_id: newDnttId
        };
      });

      // 3. Nhân đôi danh sách phân bổ chi phí
      const matchingPhanBo = phanBoList.filter(pb => pb.dntt_id === sourceDntt.id);
      const newPhanBoList: DnttPhanBo[] = matchingPhanBo.map((pb, idx) => {
        const newPbId = `PB_${Date.now()}_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`;
        const mappedItemId = idMap.get(pb.dntt_chi_tiet_id) || pb.dntt_chi_tiet_id;
        return {
          ...pb,
          id: newPbId,
          dntt_id: newDnttId,
          dntt_chi_tiet_id: mappedItemId,
          thang: Number(monthStr),
          nam: Number(yearStr)
        };
      });

      // 4. Lưu đồng bộ vào Supabase
      await apiService.save(newDntt, 'create', 'dntt');
      for (const ct of newChiTietList) {
        await apiService.save(ct, 'create', 'dntt_chi_tiet');
      }
      for (const pb of newPhanBoList) {
        await apiService.save(pb, 'create', 'dntt_phan_bo');
      }

      await onRefresh();

      // 5. Mở ngay form chỉnh sửa cho phiếu nháp mới nhân đôi
      handleOpenEditDntt(newDntt, newChiTietList, newPhanBoList);
      toast.success('Đã nhân đôi phiếu thành công dưới dạng "Lưu nháp"!');
    } catch (err: any) {
      console.error('Lỗi khi nhân đôi DNTT:', err);
      toast.error('Nhân đôi phiếu thất bại: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setSubmitting(false);
    }
  };

  // Thêm dòng nội dung thanh toán mới
  const handleAddItem = () => {
    const newItemId = `CT_${Date.now()}_${items.length + 1}`;
    const newItem: DnttChiTiet = {
      id: newItemId,
      dntt_id: currentDntt.id || `DNTT_${Date.now()}`,
      stt: items.length + 1,
      noi_dung: '',
      so_tien: 0
    };
    setItems(p => [...p, newItem]);
    setAllocationsMap(prev => ({ ...prev, [newItemId]: [] }));
  };

  // Xóa dòng nội dung thanh toán
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning('Cần ít nhất 1 dòng nội dung thanh toán trên giấy DNTT!');
      return;
    }
    const targetItem = items[index];
    setItems(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((item, idx) => ({ ...item, stt: idx + 1 }));
    });
    setAllocationsMap(prev => {
      const copy = { ...prev };
      delete copy[targetItem.id];
      return copy;
    });
  };

  // Cập nhật nội dung hoặc số tiền của dòng
  const handleUpdateItem = (index: number, field: 'noi_dung' | 'so_tien', value: any) => {
    setItems(prev => {
      const clone = [...prev];
      clone[index] = { ...clone[index], [field]: value };
      return clone;
    });
  };

  // Nhận kết quả từ modal phân bổ
  const handleSaveAllocations = (itemId: string, updated: DnttPhanBo[]) => {
    setAllocationsMap(prev => ({
      ...prev,
      [itemId]: updated
    }));
  };

  // Lưu DNTT và các dòng vào Supabase
  // mode = 'draft': Lưu nháp (cho phép lưu dở dang, không ép buộc phân bổ 100%, không tính vào thống kê)
  // mode = 'official': Lưu và ghi nhận chi phí (kiểm tra nghiêm ngặt, phân bổ khớp 100%)
  const handleSaveDntt = async (mode: 'draft' | 'official' = 'official') => {
    if (mode === 'draft') {
      if (!currentDntt.nguoi_de_nghi?.trim()) {
        toast.warning('Vui lòng nhập Họ và tên Người đề nghị trước khi lưu nháp!');
        return false;
      }
    } else {
      if (!currentDntt.nguoi_de_nghi?.trim()) {
        toast.warning('Vui lòng nhập Họ và tên Người đề nghị!');
        return false;
      }
      if (!currentDntt.noi_dung_thanh_toan?.trim()) {
        toast.warning('Vui lòng nhập Tóm tắt Nội dung thanh toán!');
        return false;
      }
      if (calculatedTotal <= 0) {
        toast.warning('Tổng số tiền đề nghị thanh toán phải lớn hơn 0!');
        return false;
      }

      for (let i = 0; i < items.length; i++) {
        if (!items[i].noi_dung?.trim()) {
          toast.warning(`Dòng ${i + 1}: Vui lòng nhập nội dung thanh toán!`);
          return false;
        }
        if (Number(items[i].so_tien) <= 0) {
          toast.warning(`Dòng ${i + 1}: Vui lòng nhập số tiền hợp lệ!`);
          return false;
        }
      }

      if (!allocationStatus.allMatched) {
        toast.error('Chưa thể lưu! Tất cả các dòng nội dung phải được phân bổ chi phí khớp 100% (Chênh lệch = 0).');
        return false;
      }
    }

    setSubmitting(true);
    try {
      const dnttId = currentDntt.id || `DNTT_${Date.now()}`;
      const isUpdate = formMode === 'update' || dnttList.some(d => d.id === dnttId);
      const nextStatus: TrangThaiDNTT = mode === 'draft'
        ? 'Lưu nháp'
        : ((isUpdate && currentDntt.trang_thai !== 'Lưu nháp') ? 'Lưu cập nhật' : 'Đã lưu');

      // 1. Lưu Header DNTT
      const dnttPayload = {
        ...currentDntt,
        id: dnttId,
        trang_thai: nextStatus,
        id_phap_nhan: activePhapNhan?.id || null,
        id_don_vi: currentDntt.id_don_vi || currentUnit?.id || null,
        don_vi_hien_thi: currentDntt.don_vi_hien_thi || defaultDonViDisplay,
        tong_so_tien: calculatedTotal,
        so_tien_bang_chu: textAmount,
        hien_thi_phan_bo: currentDntt.hien_thi_phan_bo !== false,
        hien_thi_hoa_don: currentDntt.hien_thi_hoa_don !== false,
        so_hoa_don: currentDntt.so_hoa_don || null,
        ngay_hoa_don: currentDntt.ngay_hoa_don || null,
        noi_dung_chuyen_khoan: currentDntt.noi_dung_chuyen_khoan || null,
        ghi_chu: currentDntt.ghi_chu || null,
        hien_thi_nd_ck: currentDntt.hien_thi_nd_ck !== false,
        hien_thi_ghi_chu: currentDntt.hien_thi_ghi_chu !== false,
        ky_chuc_danh_1: currentDntt.ky_chuc_danh_1 || 'Phê duyệt',
        ky_chuc_danh_2: currentDntt.ky_chuc_danh_2 || 'Kế toán - Tài chính',
        ky_chuc_danh_3: currentDntt.ky_chuc_danh_3 || 'Trưởng bộ phận',
        ky_chuc_danh_4: currentDntt.ky_chuc_danh_4 || 'Người đề nghị',
        ky_ho_ten_1: currentDntt.ky_ho_ten_1 || '',
        ky_ho_ten_2: currentDntt.ky_ho_ten_2 || '',
        ky_ho_ten_3: currentDntt.ky_ho_ten_3 || '',
        ky_ho_ten_4: currentDntt.ky_ho_ten_4 || currentDntt.nguoi_de_nghi || '',
        dia_diem_ky: currentDntt.dia_diem_ky || null,
        ngay_ky_ngay: currentDntt.ngay_ky_ngay || null,
        ngay_ky_thang: currentDntt.ngay_ky_thang || null,
        ngay_ky_nam: currentDntt.ngay_ky_nam || null,
        updated_at: new Date().toISOString()
      };

      await apiService.save(dnttPayload, isUpdate ? 'update' : 'create', 'dntt');
      setFormMode('update');
      setCurrentDntt(prev => ({ ...prev, id: dnttId, trang_thai: nextStatus }));

      // Ghi nhớ thông tin người phê duyệt & địa điểm ký vào cache theo pháp nhân
      const pnIdToSave = activePhapNhan?.id || currentDntt.id_phap_nhan;
      if (pnIdToSave) {
        saveApproverMemoryToStorage(pnIdToSave, {
          ky_chuc_danh_1: currentDntt.ky_chuc_danh_1 || 'Phê duyệt',
          ky_ho_ten_1: currentDntt.ky_ho_ten_1 || '',
          ky_chuc_danh_2: currentDntt.ky_chuc_danh_2 || 'Kế toán - Tài chính',
          ky_ho_ten_2: currentDntt.ky_ho_ten_2 || '',
          ky_chuc_danh_3: currentDntt.ky_chuc_danh_3 || 'Trưởng bộ phận',
          ky_ho_ten_3: currentDntt.ky_ho_ten_3 || '',
          dia_diem_ky: currentDntt.dia_diem_ky || ''
        });
      }

      // 2. Dọn dẹp các dòng chi tiết cũ đã xóa trên form
      const currentItemIds = new Set(items.map(it => it.id));
      const oldChiTietToDelete = chiTietList.filter(c => c.dntt_id === dnttId && !currentItemIds.has(c.id));
      for (const oldCt of oldChiTietToDelete) {
        await apiService.delete(oldCt.id, 'dntt_chi_tiet').catch(() => { });
      }

      // Lưu các dòng nội dung thanh toán (dntt_chi_tiet)
      for (const item of items) {
        const itemPayload = {
          ...item,
          dntt_id: dnttId,
          so_tien: Number(item.so_tien) || 0
        };
        const itemExists = isUpdate && chiTietList.some(c => c.id === item.id);
        await apiService.save(itemPayload, itemExists ? 'update' : 'create', 'dntt_chi_tiet');
      }

      // 3. Dọn dẹp các dòng phân bổ con cũ đã xóa trên form
      const currentPbIds = new Set<string>();
      (Object.values(allocationsMap) as DnttPhanBo[][]).forEach(subRows => {
        (subRows || []).forEach(pb => {
          if (pb?.id) currentPbIds.add(pb.id);
        });
      });
      const oldPbToDelete = phanBoList.filter(p => p.dntt_id === dnttId && !currentPbIds.has(p.id));
      for (const oldPb of oldPbToDelete) {
        await apiService.delete(oldPb.id, 'dntt_phan_bo').catch(() => { });
      }

      // Lưu các dòng phân bổ con (dntt_phan_bo)
      for (const itemId of Object.keys(allocationsMap)) {
        const subRows = allocationsMap[itemId] || [];
        for (const pb of subRows) {
          const pbPayload = {
            ...pb,
            dntt_id: dnttId,
            dntt_chi_tiet_id: itemId,
            so_tien: Number(pb.so_tien) || 0
          };
          const pbExists = isUpdate && phanBoList.some(p => p.id === pb.id);
          await apiService.save(pbPayload, pbExists ? 'update' : 'create', 'dntt_phan_bo');
        }
      }

      if (mode === 'draft') {
        toast.success('Đã lưu nháp Đề nghị thanh toán! (Bản nháp không tính vào thống kê chi phí)');
      } else {
        toast.success(isUpdate && currentDntt.trang_thai !== 'Lưu nháp' ? 'Đã lưu cập nhật Giấy Đề nghị Thanh toán!' : 'Đã lưu và ghi nhận chi phí thành công!');
      }

      await onRefresh();
      return true;
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Có lỗi xảy ra khi lưu DNTT!');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Xuất file PDF ĐNTT tải trực tiếp về máy tính
  const handleExportPdf = async () => {
    if (!allocationStatus.allMatched) {
      toast.error('Chỉ được tải file khi TẤT CẢ các dòng nội dung đều có tổng phân bổ khớp 100% (chênh lệch = 0).');
      return;
    }

    // Tự động lưu trước khi tải nếu đang sửa
    const saved = await handleSaveDntt();
    if (!saved) return;

    toast.info('Đang tạo và tải file PDF ĐNTT...');

    await exportDnttToPdf({
      dntt: {
        ...(currentDntt as DNTT),
        tong_so_tien: calculatedTotal,
        so_tien_bang_chu: textAmount
      },
      details: items,
      allocations: allocationsMap,
      phapNhan: activePhapNhan,
      donVi: {
        ...((fullDonViList.find(u => String(u.id) === String(currentDntt.id_don_vi)) || currentUnit) || ({} as DonVi)),
        ten_don_vi: currentDntt.don_vi_hien_thi || defaultDonViDisplay
      },
      kmpList,
      boPhanList,
      cap1List,
      cap2List
    });

    toast.success('Đã tải Giấy Đề nghị Thanh toán dạng PDF về máy tính!');
  };

  // Xóa DNTT (cho phép xóa cả phiếu thuộc kỳ đã chốt để giải phóng dung lượng)
  const handleDeleteDntt = async () => {
    if (!deleteTargetDntt) return;
    setSubmitting(true);
    try {
      await apiService.delete(deleteTargetDntt.id, 'dntt');
      toast.success('Đã xóa phiếu Đề nghị thanh toán!');
      setDeleteTargetDntt(null);
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Không thể xóa DNTT!');
    } finally {
      setSubmitting(false);
    }
  };

  // Lọc danh sách DNTT (kèm đơn vị cấp con/Showroom khi chọn đơn vị mẹ)
  const filteredDnttList = useMemo(() => {
    let allowedUnitIds: Set<string> | null = null;
    if (selectedUnitFilter && selectedUnitFilter !== 'ALL') {
      allowedUnitIds = new Set([selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, fullDonViList)]);
    } else if (userPermittedUnitIds) {
      allowedUnitIds = userPermittedUnitIds;
    }

    return dnttList.filter(d => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q ||
        String(d.so_dntt || '').toLowerCase().includes(q) ||
        String(d.nguoi_de_nghi || '').toLowerCase().includes(q) ||
        String(d.noi_dung_thanh_toan || '').toLowerCase().includes(q);

      let matchUnit = !allowedUnitIds;
      if (allowedUnitIds) {
        if (d.id_don_vi) {
          matchUnit = allowedUnitIds.has(String(d.id_don_vi));
        } else if (d.don_vi_hien_thi) {
          const lower = d.don_vi_hien_thi.toLowerCase().trim();
          const matchedUnit = fullDonViList.find(u => {
            const uName = (u.ten_don_vi || '').toLowerCase().trim();
            return uName && (lower === uName || lower === `thaco auto - ${uName}` || lower === `thaco auto ${uName}`);
          });
          matchUnit = matchedUnit ? allowedUnitIds.has(String(matchedUnit.id)) : false;
        } else {
          matchUnit = false;
        }
      }

      return matchSearch && matchUnit;
    });
  }, [dnttList, searchTerm, selectedUnitFilter, fullDonViList, currentUnit, userPermittedUnitIds]);

  // Cho phép chọn tất cả các phiếu trong danh sách lọc để xóa hàng loạt
  const isAllSelected = filteredDnttList.length > 0 && filteredDnttList.every(d => selectedDnttIds.has(d.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedDnttIds(new Set());
    } else {
      setSelectedDnttIds(new Set(filteredDnttList.map(d => d.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedDnttIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Xóa hàng loạt các phiếu DNTT đã chọn
  const handleExecuteBulkDelete = async () => {
    if (selectedDnttIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids: string[] = Array.from(selectedDnttIds);
      for (const id of ids) {
        await apiService.delete(id, 'dntt').catch(() => { });
      }
      toast.success(`Đã xóa thành công ${ids.length} phiếu Đề nghị thanh toán!`);
      setSelectedDnttIds(new Set());
      setBulkDeleteModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Có lỗi xảy ra khi xóa hàng loạt!');
    } finally {
      setBulkDeleting(false);
    }
  };

  // =========================================================================
  // GIAO DIỆN 1: DANH SÁCH GIẤY ĐỀ NGHỊ THANH TOÁN
  // =========================================================================
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col h-full space-y-4">
        {/* Actions Bar: Nút hành động chính đặt riêng, rõ ràng, phong cách chuẩn */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pb-1">
          <div className="text-xs text-gray-500 font-semibold flex items-center gap-2">
            <span>Danh sách Giấy đề nghị thanh toán ({filteredDnttList.length} phiếu)</span>
            {searchTerm && (
              <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Khớp từ khóa: "{searchTerm}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleStartCreateNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#D97706] hover:bg-[#b45309] text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Plus size={16} />
              <span>Lập Đề nghị thanh toán</span>
            </button>
          </div>
        </div>

        {/* List Table */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-200/80 dark:border-slate-700/80 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-700/80 text-gray-600 dark:text-gray-200 font-semibold border-b border-gray-200 dark:border-slate-600">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      disabled={filteredDnttList.length === 0}
                      className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-600 cursor-pointer disabled:opacity-30"
                      title={isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả phiếu"}
                    >
                      {isAllSelected ? (
                        <CheckSquare size={16} className="text-[#D97706]" />
                      ) : (
                        <Square size={16} className="text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="p-2 w-12 text-center">TT</th>
                  <th className="p-2 w-35">Số ĐNTT</th>
                  <th className="p-3 min-w-[200px]">Nội dung thanh toán</th>
                  <th className="p-3 w-50">Người đề nghị</th>
                  <th className="p-3 w-28">Ngày lập</th>
                  <th className="p-3 w-40 text-right">Tổng tiền (VNĐ)</th>
                  <th className="p-3 w-35 text-center">Hình thức</th>
                  <th className="p-3 w-35 text-center">Trạng thái</th>
                  <th className="p-3 w-28 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-gray-700 dark:text-gray-300">
                {filteredDnttList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-400">
                      <FileText size={36} className="mx-auto mb-2 opacity-50 text-[#D97706]" />
                      <p className="font-semibold text-gray-600 dark:text-gray-300">Chưa có Giấy đề nghị thanh toán nào.</p>
                      <p className="text-xs text-gray-400 mt-1">Bấm nút "Lập Đề nghị thanh toán" để tạo phiếu mới.</p>
                    </td>
                  </tr>
                ) : (
                  filteredDnttList.map((d, index) => {
                    const locked = isDnttLocked(d);
                    const isChecked = selectedDnttIds.has(d.id);

                    return (
                      <tr
                        key={d.id}
                        className={`hover:bg-blue-50/40 dark:hover:bg-slate-700/40 transition-colors ${isChecked ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
                          }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectRow(d.id)}
                            className="w-4 h-4 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer"
                          />
                        </td>
                        <td className="p-3 text-center text-gray-400 font-mono text-xs">{index + 1}</td>
                        <td className="p-3 font-mono font-bold text-[#D97706]">
                          <div className="flex items-center gap-1">
                            <span>{d.so_dntt || '-'}</span>
                            {locked && (
                              <span title="Kỳ chi phí đã chốt (Khóa sửa, vẫn cho phép xóa)">
                                <Lock size={12} className="text-amber-600 shrink-0" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium line-clamp-1">{d.noi_dung_thanh_toan || '-'}</div>
                          <div className="text-[11px] text-gray-400 font-mono">Đơn vị: {d.don_vi_hien_thi || fullDonViList.find(u => u.id === d.id_don_vi)?.ten_don_vi || d.id_don_vi || '-'}</div>
                        </td>
                        <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">{d.nguoi_de_nghi}</td>
                        <td className="p-3 font-mono text-gray-600 dark:text-gray-400">
                          {d.ngay_lap ? new Date(d.ngay_lap).toLocaleDateString('vi-VN') : '-'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[#D97706] whitespace-nowrap">
                          {Number(d.tong_so_tien || 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${d.hinh_thuc_thanh_toan === 'Chuyển khoản' || d.hinh_thuc_thanh_toan === 'Cấn trừ công nợ'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                            {d.hinh_thuc_thanh_toan}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {d.trang_thai === 'Lưu nháp' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                              <FileEdit size={11} /> Lưu nháp
                            </span>
                          ) : d.trang_thai === 'Lưu cập nhật' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                              <RefreshCw size={11} /> Lưu cập nhật
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 size={12} /> {d.trang_thai || 'Đã lưu'}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEditDntt(d)}
                              className="p-1.5 text-[#D97706] hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                              title={locked ? "Xem phiếu (Kỳ chi phí đã chốt — Khóa sửa)" : "Chỉnh sửa & Xem"}
                            >
                              {locked ? <Eye size={15} /> : <Edit size={15} />}
                            </button>
                            <button
                              onClick={() => handleDuplicateDntt(d)}
                              disabled={submitting}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                              title="Nhân đôi Đề nghị thanh toán (Tạo bản nháp mới)"
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              onClick={async () => {
                                const matchingDetails = chiTietList.filter(ct => ct.dntt_id === d.id);
                                const matchingPhanBo = phanBoList.filter(pb => pb.dntt_id === d.id);
                                const newAllocMap: Record<string, DnttPhanBo[]> = {};
                                matchingDetails.forEach(item => {
                                  newAllocMap[item.id] = matchingPhanBo.filter(pb => pb.dntt_chi_tiet_id === item.id);
                                });
                                toast.info('Đang tạo và tải file PDF ĐNTT...');
                                await exportDnttToPdf({
                                  dntt: d,
                                  details: matchingDetails,
                                  allocations: newAllocMap,
                                  phapNhan: phapNhanList.find(p => p.id === d.id_phap_nhan) || phapNhanList[0],
                                  donVi: donViList.find(u => u.id === d.id_don_vi),
                                  kmpList,
                                  boPhanList,
                                  cap1List,
                                  cap2List
                                });
                                toast.success('Đã tải file PDF ĐNTT về máy tính!');
                              }}
                              className="p-1.5 text-[#D97706] hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                              title="Tải file ĐNTT (.pdf)"
                            >
                              <Download size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteTargetDntt(d)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                              title="Xóa phiếu"
                            >
                              <Trash2 size={15} />
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

          <div className="p-3 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-200 dark:border-slate-600 text-xs text-gray-500 flex flex-wrap justify-between items-center gap-2">
            <span>
              Tổng cộng: <strong>{filteredDnttList.length}</strong> phiếu DNTT
              {filteredDnttList.some(d => d.trang_thai === 'Lưu nháp') && (
                <span className="ml-2 text-amber-600 font-semibold">
                  (gồm {filteredDnttList.filter(d => d.trang_thai === 'Lưu nháp').length} bản nháp)
                </span>
              )}
            </span>
            <div className="flex items-center gap-3">
              <span>
                Tổng ghi nhận chi phí:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  {filteredDnttList.filter(d => d.trang_thai !== 'Lưu nháp').reduce((s, d) => s + (Number(d.tong_so_tien) || 0), 0).toLocaleString('vi-VN')} VNĐ
                </strong>
              </span>
              {filteredDnttList.some(d => d.trang_thai === 'Lưu nháp') && (
                <span className="text-gray-400">
                  | Nháp:{' '}
                  <span className="text-amber-600 font-mono font-semibold">
                    {filteredDnttList.filter(d => d.trang_thai === 'Lưu nháp').reduce((s, d) => s + (Number(d.tong_so_tien) || 0), 0).toLocaleString('vi-VN')} VNĐ
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Floating Bulk Action Bar - Chỉ dùng cho Xóa hàng loạt */}
        {selectedDnttIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-sm text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <CheckSquare size={16} className="text-[#D97706]" />
              <span>Đã chọn <strong className="text-[#D97706] font-mono text-sm">{selectedDnttIds.size}</strong> phiếu</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBulkDeleteModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Trash2 size={14} />
                <span>Xóa {selectedDnttIds.size} phiếu đã chọn</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDnttIds(new Set())}
                className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal - Đơn lẻ */}
        {deleteTargetDntt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-md text-center space-y-3 shadow-xl border border-gray-100 dark:border-slate-700">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Xác nhận xóa phiếu DNTT?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Bạn có chắc chắn muốn xóa phiếu <strong>{deleteTargetDntt.so_dntt}</strong>? Toàn bộ các dòng chi tiết và phân bổ liên quan sẽ bị xóa vĩnh viễn.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setDeleteTargetDntt(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDeleteDntt}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Đang xóa...' : 'Xóa phiếu'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal - Hàng loạt */}
        {bulkDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-md text-center space-y-3 shadow-xl border border-gray-100 dark:border-slate-700">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Xác nhận xóa {selectedDnttIds.size} phiếu DNTT?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Bạn có chắc chắn muốn xóa vĩnh viễn <strong>{selectedDnttIds.size}</strong> phiếu Đề nghị thanh toán đã chọn? Toàn bộ các dòng chi tiết và phân bổ liên quan sẽ bị xóa khỏi hệ thống.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <button
                  type="button"
                  disabled={bulkDeleting}
                  onClick={() => setBulkDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={bulkDeleting}
                  onClick={handleExecuteBulkDelete}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {bulkDeleting ? 'Đang xóa...' : `Xóa ${selectedDnttIds.size} phiếu`}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // =========================================================================
  // GIAO DIỆN 2: BỐ CỤC CHUẨN XÁC GIẤY ĐỀ NGHỊ THANH TOÁN THEO HÌNH MẪU
  // PHẦN TRÊN KHÔNG KẺ KHUNG - CHỈ KẺ KHUNG BẢN THANH TOÁN
  // =========================================================================
  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pb-16 bg-slate-100/70 dark:bg-slate-950">
      {/* Thanh công cụ Sticky trên cùng */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <button
          onClick={() => setViewMode('list')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Quay lại danh sách</span>
        </button>

        <div className="flex items-center gap-2">
          {(() => {
            const isSavedAtLeastOnce = formMode === 'update' || dnttList.some(d => d.id === currentDntt.id);
            const isLocked = isDnttLocked(currentDntt as DNTT);

            return (
              <>
                <div className="relative inline-block" ref={saveMenuRef}>
                  <div className="inline-flex rounded-lg shadow-xs overflow-hidden border border-emerald-700/30">
                    <button
                      type="button"
                      onClick={() => setShowSaveMenu(prev => !prev)}
                      disabled={submitting || isLocked}
                      className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer active:scale-95 ${isLocked
                        ? 'opacity-40 cursor-not-allowed bg-gray-200 dark:bg-slate-700 text-gray-400'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      title={isLocked ? 'Kỳ chi phí đã chốt — Không thể lưu thay đổi' : 'Tùy chọn Lưu phiếu'}
                    >
                      {isLocked ? <Lock size={15} /> : <Save size={15} />}
                      <span>{isLocked ? 'Đã khóa kỳ' : (submitting ? 'Đang lưu...' : 'Lưu')}</span>
                      {!isLocked && <ChevronDown size={14} className={`transition-transform duration-200 ${showSaveMenu ? 'rotate-180' : ''}`} />}
                    </button>
                  </div>

                  {showSaveMenu && !isLocked && !submitting && (
                    <div className="absolute right-0 mt-1.5 w-76 sm:w-84 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSaveMenu(false);
                          handleSaveDntt('draft');
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-start gap-3 transition-colors cursor-pointer group"
                      >
                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 group-hover:scale-105 transition-transform mt-0.5">
                          <FileEdit size={16} />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                            1. Lưu nháp
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                            Lưu tạm khi đang làm dở dang, chưa phân bổ 100%. Không tính vào số liệu thống kê.
                          </div>
                        </div>
                      </button>

                      <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowSaveMenu(false);
                          handleSaveDntt('official');
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-start gap-3 transition-colors cursor-pointer group"
                      >
                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 group-hover:scale-105 transition-transform mt-0.5">
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center gap-1.5">
                            <span>2. Lưu và ghi nhận chi phí</span>
                            {!allocationStatus.allMatched && (
                              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-semibold">Chưa khớp 100%</span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                            Lưu chính thức & ghi nhận chi phí. Yêu cầu phân bổ chi phí khớp 100%.
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={!allocationStatus.allMatched || submitting || !isSavedAtLeastOnce}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all ${allocationStatus.allMatched && isSavedAtLeastOnce
                    ? 'bg-[#D97706] hover:bg-[#b45309] text-white cursor-pointer active:scale-95'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-400 cursor-not-allowed opacity-70'
                    }`}
                  title={
                    !isSavedAtLeastOnce
                      ? 'Vui lòng bấm "Lưu" trước khi tải file'
                      : !allocationStatus.allMatched
                        ? 'Vui lòng hoàn thành phân bổ khớp 100% để tải file'
                        : 'Lưu & Tải file ĐNTT (.pdf)'
                  }
                >
                  <Download size={16} />
                  <span>Tải file ĐNTT</span>
                </button>
              </>
            );
          })()}
        </div>
      </div>


      {/* TỜ GIẤY ĐỀ NGHỊ THANH TOÁN (DOCUMENT CANVAS CHUẨN XÁC THEO HÌNH MẪU) */}
      <div className="w-full flex justify-center p-3 sm:p-6">
        <div className="w-full max-w-[960px] bg-white text-slate-900 border border-slate-300 shadow-xl rounded-xs p-6 sm:p-12 font-serif text-[13px] leading-relaxed">

          {/* 1. KHỐI HEADER: LOGO THACO AUTO (DÀI 6CM RỘNG 1CM) + THÔNG TIN PHÁP NHÂN (KHÔNG KẺ KHUNG) */}
          <div className="mb-3">
            <img
              src={THACO_AUTO_LOGO_BASE64}
              alt="THACO AUTO"
              style={{ width: '6cm', height: '1cm', objectFit: 'contain' }}
              className="mb-1"
            />
            <div className="flex items-center gap-2 flex-wrap">
              {availablePhapNhanList.length > 0 ? (
                <>
                  <span className="font-bold text-[13px] uppercase text-black tracking-tight">
                    {activePhapNhan?.ten_cong_ty || 'CÔNG TY TNHH THACO AUTO'}
                  </span>
                  {availablePhapNhanList.length > 1 && (
                    <select
                      value={selectedPnId}
                      onChange={(e) => {
                        const newPnId = e.target.value;
                        setSelectedPnId(newPnId);
                        if (formMode === 'create') {
                          const mem = getApproverMemory(newPnId);
                          setCurrentDntt(prev => ({
                            ...prev,
                            id_phap_nhan: newPnId,
                            ky_chuc_danh_1: mem.ky_chuc_danh_1 || prev.ky_chuc_danh_1 || 'Phê duyệt',
                            ky_ho_ten_1: mem.ky_ho_ten_1 || '',
                            ky_chuc_danh_2: mem.ky_chuc_danh_2 || prev.ky_chuc_danh_2 || 'Kế toán - Tài chính',
                            ky_ho_ten_2: mem.ky_ho_ten_2 || '',
                            ky_chuc_danh_3: mem.ky_chuc_danh_3 || prev.ky_chuc_danh_3 || 'Trưởng bộ phận',
                            ky_ho_ten_3: mem.ky_ho_ten_3 || '',
                            dia_diem_ky: mem.dia_diem_ky || resolveLocationForPhapNhan(newPnId) || prev.dia_diem_ky || ''
                          }));
                        }
                      }}
                      className="font-sans text-[11px] border border-amber-300 rounded px-1.5 py-0.5 bg-amber-50/60 text-amber-900 font-semibold cursor-pointer"
                      title="Chọn pháp nhân trực thuộc đơn vị đang chọn"
                    >
                      {availablePhapNhanList.map(pn => (
                        <option key={pn.id} value={pn.id}>{pn.ten_cong_ty}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => setPnModalOpen(true)}
                    className="p-1 text-gray-500 hover:text-[#D97706] hover:bg-amber-50 rounded text-[11px] font-semibold flex items-center gap-0.5 cursor-pointer font-sans"
                    title="Thêm pháp nhân mới cho đơn vị này"
                  >
                    <Plus size={12} />
                    <span>Thêm</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[13px] text-gray-500 italic">
                    (Chưa có Pháp nhân cho đơn vị này)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPnModalOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#D97706] hover:bg-[#b45309] text-white text-xs font-bold rounded shadow-xs cursor-pointer font-sans"
                  >
                    <Plus size={12} />
                    <span>Thêm Pháp nhân</span>
                  </button>
                </div>
              )}
            </div>
            <div className="text-[12.5px] text-gray-800">
              {activePhapNhan?.dia_chi || 'Km 1964, QL 1A, ấp Long Bình, xã Châu Thành, tỉnh Đồng Tháp'}
            </div>
            <div className="text-[12.5px] text-gray-800 font-mono">
              MST: {activePhapNhan?.ma_so_thue || '-'}
            </div>
          </div>

          {/* 2. TIÊU ĐỀ VĂN BẢN */}
          <div className="text-center my-6">
            <div className="flex items-center justify-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-black font-serif">
                GIẤY ĐỀ NGHỊ THANH TOÁN
              </h1>
              {currentDntt.trang_thai === 'Lưu nháp' && (
                <span className="font-sans text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                  Bản nháp
                </span>
              )}
            </div>
          </div>

          {/* 3. KHỐI THÔNG TIN ĐỀ NGHỊ (KHÔNG KẺ KHUNG - THEO ĐÚNG HÌNH MẪU) */}
          <div className="space-y-1.5 text-[13px] leading-relaxed mb-4">
            {/* Dòng 1: Người đề nghị (Tự động điền theo tài khoản đăng nhập - Chỉ đọc) */}
            <div className="flex items-baseline">
              <span className="font-bold text-black w-44 shrink-0">Người đề nghị:</span>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={currentDntt.nguoi_de_nghi || user?.ho_ten || user?.username || ''}
                  className="flex-1 bg-transparent px-1 py-0.5 font-bold text-black focus:outline-none cursor-default"
                  title="Tự động điền theo tài khoản đang đăng nhập (Chỉ đọc)"
                />
              </div>
            </div>

            {/* Dòng 2: Đơn vị + Bộ phận */}
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div className="relative flex items-baseline flex-1 min-w-[320px]">
                <span className="font-bold text-black w-44 shrink-0">Đơn vị:</span>

                {!isCustomUnit ? (
                  <div className="relative flex-1 flex items-baseline">
                    <button
                      type="button"
                      onClick={() => setUnitDropdownOpen(!unitDropdownOpen)}
                      className="group inline-flex items-center gap-1.5 bg-transparent hover:bg-amber-50/70 border-b border-transparent hover:border-amber-300 rounded px-1 py-0.5 cursor-pointer text-left focus:outline-none transition-colors max-w-full"
                      title="Bấm để chọn Đơn vị / Showroom trực thuộc theo cây hoặc gõ Khác"
                    >
                      <span className="font-bold text-black text-[13px] tracking-tight">
                        {currentDntt.don_vi_hien_thi || defaultDonViDisplay}
                      </span>
                      <ChevronDown size={13} className="text-gray-400 group-hover:text-amber-600 shrink-0 self-center" />
                    </button>

                    {/* Popover danh sách cây đơn vị trực thuộc (loại trừ đại lý) */}
                    {unitDropdownOpen && (
                      <div
                        ref={unitDropdownRef}
                        className="absolute left-0 top-full mt-1 z-50 w-80 sm:w-96 max-h-80 overflow-y-auto bg-white rounded-lg shadow-2xl border border-gray-200 py-1 text-xs font-sans animate-in fade-in zoom-in-95 duration-150"
                      >
                        <div className="px-3 py-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
                          <span>Đơn vị trực thuộc</span>
                          <span className="text-[10px] font-normal text-gray-400"></span>
                        </div>

                        <div className="py-1">
                          {treeUnits.map(item => {
                            const isSelected = String(currentDntt.id_don_vi) === String(item.unit.id);
                            return (
                              <button
                                key={item.unit.id}
                                type="button"
                                onClick={() => {
                                  setCurrentDntt(p => ({
                                    ...p,
                                    id_don_vi: item.unit.id,
                                    don_vi_hien_thi: item.displayName
                                  }));
                                  setIsCustomUnit(false);
                                  setUnitDropdownOpen(false);
                                }}
                                className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-left transition-colors cursor-pointer ${isSelected
                                    ? 'bg-amber-50 text-amber-900 font-bold'
                                    : 'text-gray-700 hover:bg-gray-100 font-medium'
                                  }`}
                                style={{ paddingLeft: `${item.depth * 18 + 12}px` }}
                              >
                                {item.depth > 0 && (
                                  <span className="text-gray-400 font-mono text-[11px] select-none shrink-0">
                                    {item.isLast ? '└──' : '├──'}
                                  </span>
                                )}
                                <span className="shrink-0">{item.emoji}</span>
                                <span className="truncate flex-1">{item.unit.ten_don_vi}</span>
                                {item.depth > 0 && (
                                  <span className="text-[10px] text-gray-400 shrink-0 font-normal">Showroom</span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        <div className="border-t border-gray-100 pt-1 mt-1 bg-gray-50/50">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomUnit(true);
                              setUnitDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-amber-700 hover:bg-amber-50 font-bold transition-colors cursor-pointer"
                          >
                            <Edit size={13} className="text-amber-600 shrink-0" />
                            <span>Khác (Tự gõ tay)...</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-baseline gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={currentDntt.don_vi_hien_thi || ''}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, don_vi_hien_thi: e.target.value }))}
                      className="flex-1 bg-transparent border-b border-amber-400 focus:border-amber-600 px-1 py-0.5 font-bold text-black focus:outline-none text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomUnit(false);
                        const u = currentUnit || selectableUnits[0];
                        setCurrentDntt(p => ({
                          ...p,
                          id_don_vi: u?.id || '',
                          don_vi_hien_thi: getUnitDisplayName(u)
                        }));
                      }}
                      className="text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 cursor-pointer shrink-0 font-sans"
                      title="Quay lại chọn từ danh mục đơn vị"
                    >
                      Chọn từ danh sách
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-baseline shrink-0">
                <span className="font-bold text-black mr-2">Bộ phận:</span>
                <input
                  type="text"
                  placeholder="QTPV, AS & MTLV"
                  value={currentDntt.bo_phan_hien_thi || ''}
                  onChange={(e) => setCurrentDntt(p => ({ ...p, bo_phan_hien_thi: e.target.value }))}
                  className="w-48 bg-transparent px-1 py-0.5 text-black focus:outline-none focus:bg-blue-50/50"
                />
              </div>
            </div>

            {/* Dòng 3: Nội dung thanh toán */}
            <div className="flex items-baseline">
              <span className="font-bold text-black w-44 shrink-0">Nội dung thanh toán:</span>
              <input
                type="text"
                required
                placeholder="Tiền điện tháng 08 năm 2026"
                value={currentDntt.noi_dung_thanh_toan || ''}
                onChange={(e) => setCurrentDntt(p => ({ ...p, noi_dung_thanh_toan: e.target.value }))}
                className="flex-1 bg-transparent px-1 py-0.5 text-black focus:outline-none focus:bg-blue-50/50"
              />
            </div>

            {/* Dòng 4: Kính đề nghị Ban lãnh đạo duyệt thanh toán số tiền (nối tiếp chỉ cách 1 khoảng trắng) */}
            <div className="flex items-baseline gap-1 text-black">
              <span>Kính đề nghị Ban lãnh đạo duyệt thanh toán số tiền:</span>
              <span className="font-bold text-black font-mono text-[13.5px]">
                {calculatedTotal.toLocaleString('vi-VN')} VNĐ
              </span>
            </div>

            {/* Dòng 5: Bằng chữ (ghi chữ ra luôn, bỏ dấu []) */}
            <div className="italic text-black">
              Bằng chữ: {textAmount || 'Không đồng'}
            </div>

            {/* Dòng 6: Hình thức thanh toán (4 hình thức) */}
            <div className="flex items-center pt-0.5">
              <span className="text-black w-44 shrink-0">Hình thức thanh toán:</span>
              <div className="flex items-center gap-4 sm:gap-6 font-sans text-xs flex-wrap">
                {(['Chuyển khoản', 'Tiền mặt', 'Cấn trừ công nợ', 'Ghi nhận chi phí'] as const).map(ht => (
                  <label key={ht} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="form_hinh_thuc"
                      value={ht}
                      checked={currentDntt.hinh_thuc_thanh_toan === ht}
                      onChange={() => setCurrentDntt(p => ({ ...p, hinh_thuc_thanh_toan: ht }))}
                      className="text-[#D97706] focus:ring-[#D97706] cursor-pointer"
                    />
                    <span className={currentDntt.hinh_thuc_thanh_toan === ht ? 'font-bold text-[#D97706]' : 'text-gray-700'}>
                      {ht}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 4. BẢNG CHI TIẾT NỘI DUNG THANH TOÁN (KẺ KHUNG TOÀN BỘ - CAO MỖI HÀNG 0.5CM, PARAGRAPH TRƯỚC 3PT SAU 3PT) */}
          <table className="w-full border-collapse border border-black text-[12.5px] mb-6 table-fixed">
            <thead>
              <tr className="bg-white" style={{ height: '0.5cm' }}>
                <th className="border border-black px-2 w-12 text-center font-bold" style={{ width: '1.2cm', height: '0.5cm', padding: '3pt 6px' }}>STT</th>
                <th className="border border-black px-3 text-center font-bold" style={{ height: '0.5cm', padding: '3pt 6px' }}>Nội dung thanh toán</th>
                <th className="border border-black px-3 w-40 sm:w-44 text-center font-bold" style={{ width: '4.2cm', height: '0.5cm', padding: '3pt 6px' }}>Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const itemAllocations = (allocationsMap[item.id] || []).sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0));
                const totalItemAlloc = itemAllocations.reduce((s, a) => s + (Number(a.so_tien) || 0), 0);
                const diff = Number(item.so_tien) - totalItemAlloc;
                const isMatched = itemAllocations.length > 0 && Math.abs(diff) === 0;

                return (
                  <React.Fragment key={item.id}>
                    {/* DÒNG NỘI DUNG CHA (CÓ STT, IN ĐẬM, CÓ ĐƯỜNG KẺ BORDER TRÊN DƯỚI, CAO 0.5CM) */}
                    <tr className="bg-white group" style={{ height: '0.5cm' }}>
                      <td className="border border-black px-2 text-center font-bold font-mono align-middle" style={{ height: '0.5cm', padding: '3pt 6px' }}>
                        {item.stt || idx + 1}
                      </td>

                      <td className="border border-black px-2 align-middle" style={{ height: '0.5cm', padding: '3pt 6px' }}>
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Nhập nội dung thanh toán dòng này..."
                            value={item.noi_dung || ''}
                            onChange={(e) => handleUpdateItem(idx, 'noi_dung', e.target.value)}
                            className="w-full bg-transparent font-bold text-black focus:outline-none focus:bg-blue-50/50 px-1 py-0.5"
                          />

                          {/* Nút hành động nhanh: Phân bổ chi phí & Thêm/Xóa dòng */}
                          <div className="flex items-center gap-1 shrink-0 font-sans">
                            <button
                              type="button"
                              onClick={() => setAllocatingItem(item)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-colors cursor-pointer ${isMatched
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 animate-pulse'
                                }`}
                              title="Nhấn để mở bảng phân bổ chi phí"
                            >
                              <Layers size={11} />
                              <span>{isMatched ? `Đã khớp (${itemAllocations.length})` : 'Phân bổ CP'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleAddItem}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                              title="Thêm dòng nội dung"
                            >
                              <Plus size={13} />
                            </button>

                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                                title="Xóa dòng này"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="border border-black px-2 text-right align-middle" style={{ height: '0.5cm', padding: '3pt 6px' }}>
                        <input
                          type="text"
                          required
                          placeholder="0"
                          value={item.so_tien ? Number(item.so_tien).toLocaleString('vi-VN') : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d]/g, '');
                            handleUpdateItem(idx, 'so_tien', raw ? Number(raw) : 0);
                          }}
                          className="w-full bg-transparent text-right font-mono font-bold text-black focus:outline-none focus:bg-blue-50/50 px-1 py-0.5"
                        />
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* DÒNG THÔNG TIN HOÁ ĐƠN (SỐ HOÁ ĐƠN | NGÀY XUẤT HOÁ ĐƠN TRÊN CÙNG 1 DÒNG) */}
              <tr style={{ height: '0.75cm' }}>
                <td className="border border-black text-[12px] align-middle overflow-hidden" style={{ padding: '3pt 8px' }} colSpan={2}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 flex-nowrap min-w-0">
                      <span className="font-bold underline text-black shrink-0">Thông tin hoá đơn:</span>

                      {currentDntt.hien_thi_hoa_don !== false ? (
                        <>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-black font-semibold text-xs">Số HĐ:</span>
                            <input
                              type="text"
                              placeholder="[Số HĐ...]"
                              value={currentDntt.so_hoa_don || ''}
                              onChange={(e) => setCurrentDntt(p => ({ ...p, so_hoa_don: e.target.value }))}
                              className="w-20 sm:w-24 border-b border-dotted border-gray-400 px-1 py-0.5 bg-transparent font-mono text-xs focus:outline-none focus:border-[#D97706]"
                            />
                          </div>
                          <span className="text-gray-300 font-bold shrink-0">|</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-black font-semibold text-xs">Ngày:</span>
                            <input
                              type="date"
                              value={currentDntt.ngay_hoa_don || ''}
                              onChange={(e) => setCurrentDntt(p => ({ ...p, ngay_hoa_don: e.target.value }))}
                              className="border-b border-dotted border-gray-400 px-1 py-0.5 bg-transparent text-xs focus:outline-none focus:border-[#D97706]"
                            />
                          </div>
                        </>
                      ) : (
                        <span className="italic text-gray-400 text-xs shrink-0 font-normal">
                          (Đang ẩn trên phiếu in)
                        </span>
                      )}
                    </div>

                    <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-900 cursor-pointer select-none shrink-0 ml-auto" title="Ẩn/hiện dòng thông tin hoá đơn trên phiếu và file in">
                      <input
                        type="checkbox"
                        checked={currentDntt.hien_thi_hoa_don !== false}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setCurrentDntt(p => ({ ...p, hien_thi_hoa_don: val }));
                          if (val) {
                            toast.success('Đã bật hiển thị Thông tin hoá đơn');
                          } else {
                            toast.info('Đã ẩn dòng Thông tin hoá đơn trên phiếu in');
                          }
                        }}
                        className="w-3.5 h-3.5 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer accent-[#D97706]"
                      />
                      <span className="font-semibold text-gray-700">Ẩn/Hiện</span>
                    </label>
                  </div>
                </td>
                <td className="border border-black" style={{ height: '0.75cm' }}></td>
              </tr>

              {/* DÒNG GHI CHÚ (NẰM TRÊN THÔNG TIN CHUYỂN KHOẢN, DƯỚI THÔNG TIN HOÁ ĐƠN - CÓ THỂ ẨN/HIỆN) */}
              <tr style={{ height: '0.75cm' }}>
                <td className="border border-black text-[12px] align-middle" style={{ padding: '3pt 8px' }} colSpan={2}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-bold underline text-black shrink-0">Ghi chú:</span>
                      <input
                        type="text"
                        placeholder="[Nhập ghi chú thêm nếu cần...]"
                        value={currentDntt.ghi_chu || ''}
                        onChange={(e) => setCurrentDntt(p => ({ ...p, ghi_chu: e.target.value }))}
                        className={`flex-1 border-b border-dotted border-gray-400 px-1 py-0.5 bg-transparent text-xs focus:outline-none focus:border-[#D97706] transition-all ${currentDntt.hien_thi_ghi_chu === false ? 'opacity-40 line-through text-gray-400' : ''
                          }`}
                      />
                      {currentDntt.hien_thi_ghi_chu === false && (
                        <span className="italic text-gray-400 text-xs shrink-0 font-normal">
                          (Đang ẩn trên phiếu in)
                        </span>
                      )}
                    </div>

                    <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-900 cursor-pointer select-none shrink-0 ml-auto" title="Ẩn/hiện dòng ghi chú trên phiếu và file in">
                      <input
                        type="checkbox"
                        checked={currentDntt.hien_thi_ghi_chu !== false}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setCurrentDntt(p => ({ ...p, hien_thi_ghi_chu: val }));
                          if (val) {
                            toast.success('Đã bật hiển thị Ghi chú trên phiếu');
                          } else {
                            toast.info('Đã ẩn Ghi chú trên phiếu in');
                          }
                        }}
                        className="w-3.5 h-3.5 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer accent-[#D97706]"
                      />
                      <span className="font-semibold text-gray-700">Ẩn/Hiện</span>
                    </label>
                  </div>
                </td>
                <td className="border border-black" style={{ height: '0.75cm' }}></td>
              </tr>

              {/* KHỐI THÔNG TIN CHUYỂN KHOẢN / CẤN TRỪ CÔNG NỢ (KẺ KHUNG NHƯ HÌNH MẪU, CAO 2.5CM) */}
              {(currentDntt.hinh_thuc_thanh_toan === 'Chuyển khoản' || currentDntt.hinh_thuc_thanh_toan === 'Cấn trừ công nợ') && (
                <tr style={{ height: '2.5cm' }}>
                  <td className="border border-black text-[12px] align-top" style={{ height: '2.5cm', padding: '4pt 8px' }} colSpan={2}>
                    <div className="font-bold underline mb-1 flex items-center gap-1">
                      <CreditCard size={13} className="text-[#D97706]" />
                      <span>Thông tin tài khoản ngân hàng{currentDntt.hinh_thuc_thanh_toan === 'Cấn trừ công nợ' ? ' (Cấn trừ công nợ)' : ''}:</span>
                    </div>
                    <div className="space-y-0.5 pl-1">
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-black text-xs font-bold">Tên tài khoản:</span>
                        <input
                          type="text"
                          placeholder="[...]"
                          value={currentDntt.ten_tai_khoan || ''}
                          onChange={(e) => setCurrentDntt(p => ({ ...p, ten_tai_khoan: e.target.value }))}
                          className="flex-1 border-b border-dotted border-gray-400 px-1 py-0.5 bg-transparent uppercase font-bold focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-black text-xs font-bold">Số tài khoản:</span>
                        <input
                          type="text"
                          placeholder="[...]"
                          value={currentDntt.so_tai_khoan || ''}
                          onChange={(e) => setCurrentDntt(p => ({ ...p, so_tai_khoan: e.target.value }))}
                          className="flex-1 border-b border-dotted border-gray-400 px-1 py-0.5 bg-transparent font-mono font-bold focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-24 text-black text-xs font-bold">Tại:</span>
                        <input
                          type="text"
                          placeholder="[...]"
                          value={currentDntt.ten_ngan_hang || ''}
                          onChange={(e) => setCurrentDntt(p => ({ ...p, ten_ngan_hang: e.target.value }))}
                          className="w-40 border-b border-dotted border-gray-400 px-1 py-0.5 bg-transparent focus:outline-none focus:border-blue-600"
                        />
                        <span className="text-black text-xs font-bold">- Chi nhánh:</span>
                        <input
                          type="text"
                          placeholder="[...]"
                          value={currentDntt.chi_nhanh_ngan_hang || ''}
                          onChange={(e) => setCurrentDntt(p => ({ ...p, chi_nhanh_ngan_hang: e.target.value }))}
                          className="flex-1 border-b border-dotted border-gray-400 px-1 py-0.5 bg-transparent focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="flex items-center justify-between w-full gap-2 pt-0.5">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="w-24 text-black text-xs font-bold shrink-0">Nội dung:</span>
                          <input
                            type="text"
                            placeholder="[Nội dung chuyển khoản...]"
                            value={currentDntt.noi_dung_chuyen_khoan || ''}
                            onChange={(e) => setCurrentDntt(p => ({ ...p, noi_dung_chuyen_khoan: e.target.value }))}
                            className={`flex-1 border-b border-dotted border-gray-400 px-1 py-0.5 bg-transparent text-xs focus:outline-none focus:border-[#D97706] transition-all ${currentDntt.hien_thi_nd_ck === false ? 'opacity-40 line-through text-gray-400' : ''
                              }`}
                          />
                          {currentDntt.hien_thi_nd_ck === false && (
                            <span className="italic text-gray-400 text-xs shrink-0 font-normal">
                              (Đang ẩn trên phiếu in)
                            </span>
                          )}
                        </div>

                        <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-900 cursor-pointer select-none shrink-0 ml-auto" title="Ẩn/hiện dòng nội dung chuyển khoản trên phiếu và file in">
                          <input
                            type="checkbox"
                            checked={currentDntt.hien_thi_nd_ck !== false}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setCurrentDntt(p => ({ ...p, hien_thi_nd_ck: val }));
                              if (val) {
                                toast.success('Đã bật hiển thị Nội dung chuyển khoản trên phiếu');
                              } else {
                                toast.info('Đã ẩn Nội dung chuyển khoản trên phiếu in');
                              }
                            }}
                            className="w-3.5 h-3.5 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer accent-[#D97706]"
                          />
                          <span className="font-semibold text-gray-700">Ẩn/Hiện</span>
                        </label>
                      </div>
                    </div>
                  </td>
                  <td className="border border-black" style={{ height: '2.5cm' }}></td>
                </tr>
              )}

              {/* DÒNG GIÁ TRỊ PHẢI THANH TOÁN (KẺ KHUNG - NHƯ HÌNH MẪU, CAO 0.5CM) */}
              <tr style={{ height: '0.5cm' }}>
                <td className="border border-black text-center font-bold text-[13px] align-middle" style={{ height: '0.5cm', padding: '3pt 8px' }} colSpan={2}>
                  Giá trị phải thanh toán
                </td>
                <td className="border border-black text-right font-mono font-bold text-[13px] text-black whitespace-nowrap align-middle" style={{ height: '0.5cm', padding: '3pt 8px' }}>
                  {calculatedTotal.toLocaleString('vi-VN')}
                </td>
              </tr>
            </tbody>
          </table>

          {/* GHI CHÚ THAM CHIẾU BẢNG KÊ PHÂN BỔ ĐÍNH KÈM (TRANG 2) */}
          {currentDntt.hien_thi_phan_bo !== false && (
            <div className="flex items-center justify-between text-[11.5px] italic text-gray-600 mb-3 px-1 flex-wrap gap-2">
              <span>(*) Chi tiết phân bổ khoản mục phí và bộ phận xem tại Bảng kê phân bổ chi phí đính kèm.</span>
              <button
                type="button"
                onClick={() => setPreviewBangKeOpen(true)}
                className="not-italic inline-flex items-center gap-1 text-[#D97706] hover:text-[#b45309] font-bold text-xs underline cursor-pointer"
                title="Bấm để xem trước Bảng kê phân bổ chi phí đính kèm (Trang 2)"
              >
                <Eye size={13} />
                <span>Xem Bảng kê đính kèm</span>
              </button>
            </div>
          )}

          {/* 5. KHỐI NGÀY THÁNG VÀ 4 CHỮ KÝ HÀNH CHÍNH (KHÔNG KẺ KHUNG - KHỚP HÌNH MẪU) */}
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <button
                type="button"
                onClick={handleApplyPreviousApprovers}
                className="font-sans text-[11px] font-semibold text-amber-800 dark:text-amber-200 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
                title="Gợi ý nhanh thông tin người duyệt và địa điểm ký từ phiếu trước của pháp nhân này"
              >
                <Sparkles size={13} className="text-[#D97706]" />
                <span>Gợi ý nhanh</span>
              </button>

              <div className="flex items-center justify-end gap-1.5 italic text-[12.5px] text-gray-800 ml-auto flex-wrap">
                <input
                  type="text"
                  list="dntt-signature-locations"
                  placeholder="......"
                  value={currentDntt.dia_diem_ky ?? ''}
                  onChange={(e) => setCurrentDntt(p => ({ ...p, dia_diem_ky: e.target.value }))}
                  className="w-28 text-right bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none italic text-black font-medium"
                  title="Gõ địa danh (ví dụ: Đồng Tháp, TP.HCM... nếu để trống sẽ hiển thị ......)"
                />
                <span>, ngày</span>
                <input
                  type="text"
                  value={currentDntt.ngay_ky_ngay ?? String(new Date().getDate()).padStart(2, '0')}
                  onChange={(e) => setCurrentDntt(p => ({ ...p, ngay_ky_ngay: e.target.value }))}
                  className="w-9 text-center bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none italic text-black font-semibold"
                  title="Ngày ký (mặc định ngày hiện tại)"
                />
                <span>tháng</span>
                <input
                  type="text"
                  value={currentDntt.ngay_ky_thang ?? String(new Date().getMonth() + 1).padStart(2, '0')}
                  onChange={(e) => setCurrentDntt(p => ({ ...p, ngay_ky_thang: e.target.value }))}
                  className="w-9 text-center bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none italic text-black font-semibold"
                  title="Tháng ký (mặc định tháng hiện tại)"
                />
                <span>năm</span>
                <input
                  type="text"
                  value={currentDntt.ngay_ky_nam ?? String(new Date().getFullYear())}
                  onChange={(e) => setCurrentDntt(p => ({ ...p, ngay_ky_nam: e.target.value }))}
                  className="w-14 text-center bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none italic text-black font-semibold"
                  title="Năm ký (mặc định năm hiện tại)"
                />
              </div>
            </div>

            <table className="w-full border-collapse border-none text-center">
              <thead>
                <tr>
                  <th className="w-1/4 py-1 font-bold text-center text-black text-[12.5px]">
                    <input
                      type="text"
                      list="dntt-approver-titles"
                      value={currentDntt.ky_chuc_danh_1 || 'Phê duyệt'}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_chuc_danh_1: e.target.value }))}
                      className="w-full text-center font-bold text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none transition-colors"
                      title="Bấm để chỉnh sửa chức danh người phê duyệt"
                    />
                  </th>
                  <th className="w-1/4 py-1 font-bold text-center text-black text-[12.5px]">
                    <input
                      type="text"
                      list="dntt-accountant-titles"
                      value={currentDntt.ky_chuc_danh_2 || 'Kế toán - Tài chính'}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_chuc_danh_2: e.target.value }))}
                      className="w-full text-center font-bold text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none transition-colors"
                      title="Bấm để chỉnh sửa chức danh kế toán"
                    />
                  </th>
                  <th className="w-1/4 py-1 font-bold text-center text-black text-[12.5px]">
                    <input
                      type="text"
                      list="dntt-dept-titles"
                      value={currentDntt.ky_chuc_danh_3 || 'Trưởng bộ phận'}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_chuc_danh_3: e.target.value }))}
                      className="w-full text-center font-bold text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none transition-colors"
                      title="Bấm để chỉnh sửa chức danh trưởng bộ phận"
                    />
                  </th>
                  <th className="w-1/4 py-1 font-bold text-center text-black text-[12.5px]">
                    <input
                      type="text"
                      value={currentDntt.ky_chuc_danh_4 || 'Người đề nghị'}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_chuc_danh_4: e.target.value }))}
                      className="w-full text-center font-bold text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none transition-colors"
                      title="Bấm để chỉnh sửa chức danh"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="h-16 sm:h-20"></td>
                  <td className="h-16 sm:h-20"></td>
                  <td className="h-16 sm:h-20"></td>
                  <td className="h-16 sm:h-20"></td>
                </tr>
                <tr>
                  <td className="text-center text-[12px] px-1">
                    <input
                      type="text"
                      list="dntt-approver-names"
                      placeholder="[Gõ họ và tên]"
                      value={currentDntt.ky_ho_ten_1 || ''}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_ho_ten_1: e.target.value }))}
                      className="w-full text-center text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none text-[12px] placeholder:italic placeholder:text-gray-400 font-semibold"
                      title="Gõ họ và tên người phê duyệt (hoặc chọn từ gợi ý đã từng duyệt)"
                    />
                  </td>
                  <td className="text-center text-[12px] px-1">
                    <input
                      type="text"
                      list="dntt-accountant-names"
                      placeholder="[Gõ họ và tên]"
                      value={currentDntt.ky_ho_ten_2 || ''}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_ho_ten_2: e.target.value }))}
                      className="w-full text-center text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none text-[12px] placeholder:italic placeholder:text-gray-400 font-semibold"
                      title="Gõ họ và tên kế toán"
                    />
                  </td>
                  <td className="text-center text-[12px] px-1">
                    <input
                      type="text"
                      list="dntt-dept-names"
                      placeholder="[Gõ họ và tên]"
                      value={currentDntt.ky_ho_ten_3 || ''}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_ho_ten_3: e.target.value }))}
                      className="w-full text-center text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none text-[12px] placeholder:italic placeholder:text-gray-400 font-semibold"
                      title="Gõ họ và tên trưởng bộ phận"
                    />
                  </td>
                  <td className="text-center font-bold text-black text-[12.5px] px-1">
                    <input
                      type="text"
                      placeholder="[Gõ họ và tên]"
                      value={currentDntt.ky_ho_ten_4 !== undefined ? currentDntt.ky_ho_ten_4 : (currentDntt.nguoi_de_nghi || '')}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_ho_ten_4: e.target.value }))}
                      className="w-full text-center font-bold text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none text-[12.5px] placeholder:italic placeholder:text-gray-400"
                      title="Gõ họ và tên người đề nghị"
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Datalists gợi ý chức vụ & họ tên đã từng dùng trong pháp nhân này */}
            <datalist id="dntt-approver-names">
              {approverSuggestions.names1.map(n => <option key={n} value={n} />)}
            </datalist>
            <datalist id="dntt-approver-titles">
              {approverSuggestions.titles1.map(t => <option key={t} value={t} />)}
            </datalist>
            <datalist id="dntt-accountant-names">
              {approverSuggestions.names2.map(n => <option key={n} value={n} />)}
            </datalist>
            <datalist id="dntt-accountant-titles">
              {approverSuggestions.titles2.map(t => <option key={t} value={t} />)}
            </datalist>
            <datalist id="dntt-dept-names">
              {approverSuggestions.names3.map(n => <option key={n} value={n} />)}
            </datalist>
            <datalist id="dntt-dept-titles">
              {approverSuggestions.titles3.map(t => <option key={t} value={t} />)}
            </datalist>
            <datalist id="dntt-signature-locations">
              {approverSuggestions.locations.map(loc => <option key={loc} value={loc} />)}
            </datalist>
          </div>
        </div>
      </div>

      {/* Allocation Modal Popup */}
      <DnttAllocationModal
        isOpen={!!allocatingItem}
        onClose={() => setAllocatingItem(null)}
        parentItem={allocatingItem}
        allocations={allocatingItem ? (allocationsMap[allocatingItem.id] || []) : []}
        onSaveAllocations={handleSaveAllocations}
        kmpList={kmpList}
        boPhanList={boPhanList}
        cap1List={cap1List}
        cap2List={cap2List}
        unitId={currentDntt.id_don_vi || selectedUnitFilter}
      />

      {/* Modal Thêm Pháp nhân Nhanh */}
      {pnModalOpen && (
        <PnModal
          isOpen={pnModalOpen}
          mode="create"
          currentData={null}
          selectedUnitId={currentUnit?.id || (selectedUnitFilter !== 'ALL' ? selectedUnitFilter : null)}
          unitList={donViList}
          onSaved={async (savedData) => {
            setPnModalOpen(false);
            await onRefresh();
            if (savedData?.id) {
              setSelectedPnId(savedData.id);
            }
          }}
          onClose={() => setPnModalOpen(false)}
        />
      )}
    </div>
  );
}
