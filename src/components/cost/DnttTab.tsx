import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Edit, Trash2, Download, FileText, CheckCircle2,
  ArrowLeft, Save, CreditCard, Layers, RefreshCw, AlertTriangle,
  Eye, X, Lock, CheckSquare, Square
} from 'lucide-react';
import {
  DNTT, DnttChiTiet, DnttPhanBo, DmKmp, DmBoPhan, BoPhanCap1,
  BoPhanCap2, PhapNhan, DonVi, ChiPhiChotKy
} from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../utils/toast';
import { numberToWordsVN } from '../../utils/numberToWordsVN';
import { getAllSubordinateIds } from '../../utils/hierarchy';
import { THACO_AUTO_LOGO_BASE64 } from '../../assets/thacoAutoLogo';
import DnttAllocationModal from './DnttAllocationModal';
import { exportDnttToPdf } from './exportDnttPdf';

interface Props {
  dnttList: DNTT[];
  chiTietList: DnttChiTiet[];
  phanBoList: DnttPhanBo[];
  kmpList: DmKmp[];
  boPhanList?: DmBoPhan[];
  cap1List: BoPhanCap1[];
  cap2List: BoPhanCap2[];
  donViList: DonVi[];
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
    nguoi_de_nghi: user?.ho_ten || '',
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
    trang_thai: 'Nháp',
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
    ky_ho_ten_4: user?.ho_ten || ''
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

  // Bulk selection & Status Update
  const [selectedDnttIds, setSelectedDnttIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<'Nháp' | 'Chờ duyệt' | 'Đã duyệt' | 'Đã thanh toán' | 'Từ chối'>('Đã thanh toán');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Kiểm tra phiếu có thuộc kỳ chi phí đã chốt hay không
  const isDnttLocked = (d?: DNTT | Partial<DNTT> | null) => {
    if (!d || !d.ngay_lap) return false;
    const date = new Date(d.ngay_lap);
    if (isNaN(date.getTime())) return false;
    const thang = date.getMonth() + 1;
    const nam = date.getFullYear();
    return chotKyList.some(ck => ck.nam === nam && ck.thang === thang && ck.trang_thai === 'da_chot');
  };

  // =========================================================================
  // 1. XÁC ĐỊNH ĐƠN VỊ & GIA ĐÌNH ĐƠN VỊ ĐƯỢC CHỌN BÊN NGOÀI
  // =========================================================================
  const currentUnit = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') {
      return donViList.length > 0 ? donViList[0] : null;
    }
    return donViList.find(d => String(d.id) === String(selectedUnitFilter)) || null;
  }, [selectedUnitFilter, donViList]);

  // Tập hợp tất cả các ID đơn vị thuộc cùng gia đình (đơn vị đang chọn + cấp dưới + cấp trên)
  const familyUnitIds = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') return null;

    // Lấy toàn bộ đơn vị cấp dưới trực tiếp và gián tiếp
    const subIds = getAllSubordinateIds(selectedUnitFilter, donViList);

    // Lấy các đơn vị cấp trên (bỏ qua 'HO' và 'DV_HO')
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

  // Định dạng tên đơn vị hiển thị chuẩn mẫu (VD: Showroom Mỹ Tho - THACO AUTO Đồng Tháp)
  const defaultDonViDisplay = useMemo(() => {
    if (!currentUnit) return 'Showroom Mỹ Tho - THACO AUTO Đồng Tháp';
    if (currentUnit.cap_quan_ly && currentUnit.cap_quan_ly !== 'HO' && currentUnit.cap_quan_ly !== 'DV_HO') {
      const parent = donViList.find(u => String(u.id) === String(currentUnit.cap_quan_ly));
      if (parent && parent.ten_don_vi !== currentUnit.ten_don_vi) {
        return `${currentUnit.ten_don_vi} - ${parent.ten_don_vi}`;
      }
    }
    return currentUnit.ten_don_vi;
  }, [currentUnit, donViList]);

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

    setCurrentDntt({
      id: defaultDnttId,
      so_dntt: `DNTT-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      ngay_lap: dateStr,
      id_phap_nhan: defaultPhapNhan?.id || '',
      id_don_vi: currentUnit?.id || '',
      nguoi_de_nghi: user?.ho_ten || '',
      bo_phan_hien_thi: 'QTPV, AS & MTLV',
      don_vi_hien_thi: defaultDonViDisplay,
      noi_dung_thanh_toan: '',
      tong_so_tien: 0,
      so_tien_bang_chu: '',
      hinh_thuc_thanh_toan: 'Chuyển khoản',
      ten_tai_khoan: '',
      so_tai_khoan: '',
      ten_ngan_hang: '',
      chi_nhanh_ngan_hang: '',
      trang_thai: 'Nháp',
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
      ky_ho_ten_4: user?.ho_ten || ''
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

    setFormMode('create');
    setViewMode('form');
  };

  // Mở form sửa DNTT cũ
  const handleOpenEditDntt = (dntt: DNTT) => {
    setCurrentDntt({
      ...dntt,
      don_vi_hien_thi: dntt.don_vi_hien_thi || defaultDonViDisplay,
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
    const matchingDetails = chiTietList
      .filter(ct => ct.dntt_id === dntt.id)
      .sort((a, b) => (a.stt || 0) - (b.stt || 0));

    // Lọc các dòng phân bổ thuộc dntt này
    const matchingPhanBo = phanBoList.filter(pb => pb.dntt_id === dntt.id);
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
  const handleSaveDntt = async () => {
    if (!currentDntt.nguoi_de_nghi?.trim()) {
      toast.warning('Vui lòng nhập Họ và tên Người đề nghị!');
      return;
    }
    if (!currentDntt.noi_dung_thanh_toan?.trim()) {
      toast.warning('Vui lòng nhập Tóm tắt Nội dung thanh toán!');
      return;
    }
    if (calculatedTotal <= 0) {
      toast.warning('Tổng số tiền đề nghị thanh toán phải lớn hơn 0!');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].noi_dung?.trim()) {
        toast.warning(`Dòng ${i + 1}: Vui lòng nhập nội dung thanh toán!`);
        return;
      }
      if (Number(items[i].so_tien) <= 0) {
        toast.warning(`Dòng ${i + 1}: Vui lòng nhập số tiền hợp lệ!`);
        return;
      }
    }

    if (!allocationStatus.allMatched) {
      toast.error('Chưa thể lưu! Tất cả các dòng nội dung phải được phân bổ chi phí khớp 100% (Chênh lệch = 0).');
      return;
    }

    setSubmitting(true);
    try {
      const dnttId = currentDntt.id || `DNTT_${Date.now()}`;

      // 1. Lưu Header DNTT
      const dnttPayload = {
        ...currentDntt,
        id: dnttId,
        id_phap_nhan: activePhapNhan?.id || null,
        id_don_vi: currentUnit?.id || null,
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
        updated_at: new Date().toISOString()
      };

      const isUpdate = formMode === 'update' || dnttList.some(d => d.id === dnttId);
      await apiService.save(dnttPayload, isUpdate ? 'update' : 'create', 'dntt');
      setFormMode('update');
      setCurrentDntt(prev => ({ ...prev, id: dnttId }));

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
          so_tien: Number(item.so_tien)
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
            so_tien: Number(pb.so_tien)
          };
          const pbExists = isUpdate && phanBoList.some(p => p.id === pb.id);
          await apiService.save(pbPayload, pbExists ? 'update' : 'create', 'dntt_phan_bo');
        }
      }

      toast.success('Đã lưu Giấy Đề nghị Thanh toán thành công!');
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
        ...(currentUnit || ({} as DonVi)),
        ten_don_vi: currentDntt.don_vi_hien_thi || defaultDonViDisplay
      },
      kmpList,
      boPhanList,
      cap1List,
      cap2List
    });

    toast.success('Đã tải Giấy Đề nghị Thanh toán dạng PDF về máy tính!');
  };

  // Xóa DNTT
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
    const allowedUnitIds = (!selectedUnitFilter || selectedUnitFilter === 'ALL')
      ? null
      : new Set([selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, donViList)]);

    return dnttList.filter(d => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q ||
        String(d.so_dntt || '').toLowerCase().includes(q) ||
        String(d.nguoi_de_nghi || '').toLowerCase().includes(q) ||
        String(d.noi_dung_thanh_toan || '').toLowerCase().includes(q);

      const matchUnit = !allowedUnitIds || (d.id_don_vi && allowedUnitIds.has(String(d.id_don_vi)));
      return matchSearch && matchUnit;
    });
  }, [dnttList, searchTerm, selectedUnitFilter, donViList]);

  // Danh sách các phiếu có thể chọn thao tác hàng loạt (loại trừ các phiếu thuộc kỳ đã chốt)
  const selectableDntts = useMemo(() => {
    return filteredDnttList.filter(d => !isDnttLocked(d));
  }, [filteredDnttList, chotKyList]);

  const isAllSelected = selectableDntts.length > 0 && selectableDntts.every(d => selectedDnttIds.has(d.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedDnttIds(new Set());
    } else {
      setSelectedDnttIds(new Set(selectableDntts.map(d => d.id)));
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

  const handleExecuteBulkUpdate = async () => {
    if (selectedDnttIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const ids = Array.from(selectedDnttIds);
      const res = await apiService.updateDnttStatusBulk(ids, bulkStatus, user?.ho_ten || 'User');
      if (res.skippedLockedCount > 0) {
        toast.warning(`Đã cập nhật ${res.updatedCount} phiếu sang "${bulkStatus}". Bỏ qua ${res.skippedLockedCount} phiếu thuộc kỳ đã chốt.`);
      } else {
        toast.success(`Đã cập nhật thành công ${res.updatedCount} phiếu sang "${bulkStatus}"!`);
      }
      setSelectedDnttIds(new Set());
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Lỗi cập nhật trạng thái hàng loạt!');
    } finally {
      setBulkUpdating(false);
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
                      disabled={selectableDntts.length === 0}
                      className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-600 cursor-pointer disabled:opacity-30"
                      title={isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả phiếu chưa chốt"}
                    >
                      {isAllSelected ? (
                        <CheckSquare size={16} className="text-[#D97706]" />
                      ) : (
                        <Square size={16} className="text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="p-3 w-12 text-center">TT</th>
                  <th className="p-3 w-35">Số ĐNTT</th>
                  <th className="p-3 min-w-[200px]">Nội dung thanh toán</th>
                  <th className="p-3 w-55">Người đề nghị</th>
                  <th className="p-3 w-28">Ngày lập</th>
                  <th className="p-3 w-36 text-right">Tổng tiền (VNĐ)</th>
                  <th className="p-3 w-35 text-center">Hình thức</th>
                  <th className="p-3 w-28 text-center">Trạng thái</th>
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
                        className={`hover:bg-blue-50/40 dark:hover:bg-slate-700/40 transition-colors ${
                          isChecked ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          {locked ? (
                            <span
                              className="inline-flex items-center justify-center p-1 text-amber-600 cursor-not-allowed"
                              title="Phiếu này thuộc kỳ chi phí đã chốt — Đã khóa thao tác"
                            >
                              <Lock size={15} />
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectRow(d.id)}
                              className="w-4 h-4 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer"
                            />
                          )}
                        </td>
                        <td className="p-3 text-center text-gray-400 font-mono text-xs">{index + 1}</td>
                        <td className="p-3 font-mono font-bold text-[#D97706]">
                          <div className="flex items-center gap-1">
                            <span>{d.so_dntt || '-'}</span>
                            {locked && (
                              <span title="Kỳ chi phí đã chốt">
                                <Lock size={12} className="text-amber-600 shrink-0" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium line-clamp-1">{d.noi_dung_thanh_toan || '-'}</div>
                          <div className="text-[11px] text-gray-400 font-mono">Đơn vị: {d.don_vi_hien_thi || donViList.find(u => u.id === d.id_don_vi)?.ten_don_vi || d.id_don_vi || '-'}</div>
                        </td>
                        <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">{d.nguoi_de_nghi}</td>
                        <td className="p-3 font-mono text-gray-600 dark:text-gray-400">
                          {d.ngay_lap ? new Date(d.ngay_lap).toLocaleDateString('vi-VN') : '-'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[#D97706] whitespace-nowrap">
                          {Number(d.tong_so_tien || 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${d.hinh_thuc_thanh_toan === 'Chuyển khoản'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                            {d.hinh_thuc_thanh_toan}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <CheckCircle2 size={13} /> {d.trang_thai || 'Hoàn tất'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEditDntt(d)}
                              className="p-1.5 text-[#D97706] hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
                              title={locked ? "Xem phiếu (Kỳ chi phí đã chốt)" : "Chỉnh sửa & Xem"}
                            >
                              {locked ? <Eye size={15} /> : <Edit size={15} />}
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
                              onClick={() => {
                                if (locked) {
                                  toast.warning('Phiếu này thuộc kỳ chi phí đã chốt. Không thể xóa!');
                                  return;
                                }
                                setDeleteTargetDntt(d);
                              }}
                              disabled={locked}
                              className={`p-1.5 rounded-lg transition-colors ${
                                locked
                                  ? 'text-gray-300 dark:text-slate-600 cursor-not-allowed'
                                  : 'text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 cursor-pointer'
                              }`}
                              title={locked ? "Không thể xóa phiếu thuộc kỳ đã chốt" : "Xóa phiếu"}
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

          <div className="p-3 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-200 dark:border-slate-600 text-xs text-gray-500 flex justify-between items-center">
            <span>Tổng cộng: <strong>{filteredDnttList.length}</strong> phiếu DNTT</span>
            <span>Tổng số tiền: <strong className="text-[#D97706] font-mono text-sm">{filteredDnttList.reduce((s, d) => s + (Number(d.tong_so_tien) || 0), 0).toLocaleString('vi-VN')} VNĐ</strong></span>
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedDnttIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-sm text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <CheckSquare size={16} className="text-[#D97706]" />
              <span>Đã chọn <strong className="text-[#D97706] font-mono text-sm">{selectedDnttIds.size}</strong> phiếu</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">Đổi trạng thái:</span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as any)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D97706]"
              >
                <option value="Nháp">Nháp</option>
                <option value="Chờ duyệt">Chờ duyệt</option>
                <option value="Đã duyệt">Đã duyệt</option>
                <option value="Đã thanh toán">Đã thanh toán</option>
                <option value="Từ chối">Từ chối</option>
              </select>
              <button
                type="button"
                onClick={handleExecuteBulkUpdate}
                disabled={bulkUpdating}
                className="px-3.5 py-1.5 bg-[#D97706] hover:bg-[#b45309] text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              >
                {bulkUpdating ? 'Đang cập nhật...' : 'Áp dụng'}
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

        {/* Delete Confirmation Modal */}
        {deleteTargetDntt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-5 w-full max-w-md text-center space-y-3 shadow-xl">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <h3 className="text-base font-bold text-gray-900">Xác nhận xóa phiếu DNTT?</h3>
              <p className="text-xs text-gray-500">
                Bạn có chắc chắn muốn xóa phiếu <strong>{deleteTargetDntt.so_dntt}</strong>? Toàn bộ các dòng chi tiết và phân bổ liên quan sẽ bị xóa vĩnh viễn.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetDntt(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDntt}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Xóa phiếu
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
          {/* Toggle Ẩn / Hiện Phân bổ trên giấy DNTT */}
          <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-700/60 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shadow-2xs">
            <input
              type="checkbox"
              checked={currentDntt.hien_thi_phan_bo !== false}
              onChange={(e) => setCurrentDntt(prev => ({ ...prev, hien_thi_phan_bo: e.target.checked }))}
              className="w-4 h-4 rounded text-[#D97706] focus:ring-[#D97706] cursor-pointer"
            />
            <span>Hiện phân bổ trên phiếu</span>
          </label>

          {/* Trạng thái phân bổ */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${allocationStatus.allMatched
            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
            : 'bg-amber-50 text-amber-700 border-amber-300'
            }`}>
            {allocationStatus.allMatched ? (
              <>
                <CheckCircle2 size={15} />
                <span>Đã phân bổ khớp 100% ({items.length} dòng)</span>
              </>
            ) : (
              <>
                <AlertTriangle size={15} />
                <span>Chưa khớp 100% (cần phân bổ đủ để tải file)</span>
              </>
            )}
          </div>

          <button
            onClick={handleSaveDntt}
            disabled={submitting || isDnttLocked(currentDntt as DNTT)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 border border-gray-300 dark:border-slate-600 text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors ${
              isDnttLocked(currentDntt as DNTT)
                ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-slate-700 text-gray-400'
                : 'hover:bg-gray-50 text-gray-700 dark:text-gray-200 cursor-pointer'
            }`}
            title={isDnttLocked(currentDntt as DNTT) ? 'Kỳ chi phí đã chốt — Không thể lưu thay đổi' : 'Lưu nháp'}
          >
            {isDnttLocked(currentDntt as DNTT) ? <Lock size={15} className="text-amber-600" /> : <Save size={15} />}
            <span>{isDnttLocked(currentDntt as DNTT) ? 'Đã khóa kỳ' : (submitting ? 'Đang lưu...' : 'Lưu nháp')}</span>
          </button>

          {currentDntt.hien_thi_phan_bo !== false && (
            <button
              type="button"
              onClick={() => setPreviewBangKeOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 dark:border-amber-700 bg-amber-50/70 hover:bg-amber-100 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
              title="Xem trước Bảng kê phân bổ chi phí đính kèm (Trang 2)"
            >
              <Eye size={15} />
              <span>Xem Bảng kê đính kèm</span>
            </button>
          )}

          <button
            onClick={handleExportPdf}
            disabled={!allocationStatus.allMatched || submitting}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all ${allocationStatus.allMatched
              ? 'bg-[#D97706] hover:bg-[#b45309] text-white cursor-pointer'
              : 'bg-gray-300 dark:bg-slate-700 text-gray-400 cursor-not-allowed opacity-70'
              }`}
            title={allocationStatus.allMatched ? 'Lưu & Tải file ĐNTT (.pdf)' : 'Vui lòng hoàn thành phân bổ khớp 100% để tải file'}
          >
            <Download size={16} />
            <span>Tải file ĐNTT</span>
          </button>
        </div>
      </div>

      {/* Banner thông báo nếu phiếu thuộc kỳ đã chốt */}
      {isDnttLocked(currentDntt as DNTT) && (
        <div className="max-w-[960px] mx-auto w-full px-3 pt-3">
          <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-xs">
            <Lock size={20} className="text-[#D97706] shrink-0" />
            <div className="flex-1 leading-relaxed">
              <strong>Kỳ chi phí đã chốt:</strong> Phiếu ĐNTT này thuộc kỳ tài chính đã được chốt và đóng băng số liệu. Chế độ hiện tại là <strong>Chỉ xem</strong>. Để thay đổi số tiền, KMP hoặc xóa phiếu, Quản trị viên cần thực hiện "Hủy chốt kỳ" tương ứng trong tab Thống kê.
            </div>
          </div>
        </div>
      )}

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
              <span className="font-bold text-[13px] uppercase text-black tracking-tight">
                {activePhapNhan?.ten_cong_ty || 'CÔNG TY TNHH THACO AUTO ĐỒNG THÁP'}
              </span>

              {/* Lựa chọn pháp nhân (chỉ hiển thị các pháp nhân thuộc đơn vị đang chọn) */}
              {availablePhapNhanList.length > 1 && (
                <select
                  value={selectedPnId}
                  onChange={(e) => setSelectedPnId(e.target.value)}
                  className="font-sans text-[11px] border border-blue-300 rounded px-1.5 py-0.5 bg-blue-50/60 text-blue-800 font-semibold cursor-pointer"
                  title="Chọn pháp nhân trực thuộc đơn vị đang chọn"
                >
                  {availablePhapNhanList.map(pn => (
                    <option key={pn.id} value={pn.id}>{pn.ten_cong_ty}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="text-[12.5px] text-gray-800">
              {activePhapNhan?.dia_chi || 'Km 1964, QL 1A, ấp Long Bình, xã Châu Thành, tỉnh Đồng Tháp'}
            </div>
            <div className="text-[12.5px] text-gray-800 font-mono">
              MST: {activePhapNhan?.ma_so_thue || '1201657894'}
            </div>
          </div>

          {/* 2. TIÊU ĐỀ VĂN BẢN */}
          <div className="text-center my-6">
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-black font-serif">
              GIẤY ĐỀ NGHỊ THANH TOÁN
            </h1>
          </div>

          {/* 3. KHỐI THÔNG TIN ĐỀ NGHỊ (KHÔNG KẺ KHUNG - THEO ĐÚNG HÌNH MẪU) */}
          <div className="space-y-1.5 text-[13px] leading-relaxed mb-4">
            {/* Dòng 1: Người đề nghị */}
            <div className="flex items-baseline">
              <span className="font-bold text-black w-44 shrink-0">Người đề nghị:</span>
              <input
                type="text"
                required
                placeholder="Hồ Khánh Băng"
                value={currentDntt.nguoi_de_nghi || ''}
                onChange={(e) => setCurrentDntt(p => ({ ...p, nguoi_de_nghi: e.target.value }))}
                className="flex-1 bg-transparent px-1 py-0.5 font-bold text-black focus:outline-none focus:bg-blue-50/50"
              />
            </div>

            {/* Dòng 2: Đơn vị + Bộ phận */}
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div className="flex items-baseline flex-1 min-w-[280px]">
                <span className="font-bold text-black w-44 shrink-0">Đơn vị:</span>
                <input
                  type="text"
                  value={currentDntt.don_vi_hien_thi ?? defaultDonViDisplay}
                  onChange={(e) => setCurrentDntt(p => ({ ...p, don_vi_hien_thi: e.target.value }))}
                  className="flex-1 bg-transparent px-1 py-0.5 font-bold text-black focus:outline-none focus:bg-blue-50/50"
                />
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

            {/* Dòng 6: Hình thức thanh toán */}
            <div className="flex items-center pt-0.5">
              <span className="text-black w-44 shrink-0">Hình thức thanh toán:</span>
              <div className="flex items-center gap-6 font-sans text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="form_hinh_thuc"
                    value="Chuyển khoản"
                    checked={currentDntt.hinh_thuc_thanh_toan === 'Chuyển khoản'}
                    onChange={() => setCurrentDntt(p => ({ ...p, hinh_thuc_thanh_toan: 'Chuyển khoản' }))}
                  />
                  <span>Chuyển khoản</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="form_hinh_thuc"
                    value="Tiền mặt"
                    checked={currentDntt.hinh_thuc_thanh_toan === 'Tiền mặt'}
                    onChange={() => setCurrentDntt(p => ({ ...p, hinh_thuc_thanh_toan: 'Tiền mặt' }))}
                  />
                  <span>Tiền mặt</span>
                </label>
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
                              <span>{isMatched ? `Đã khớp (${itemAllocations.length})` : 'Phân bổ ngay'}</span>
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

              {/* KHỐI THÔNG TIN CHUYỂN KHOẢN (NẾU CHỌN CHUYỂN KHOẢN - KẺ KHUNG NHƯ HÌNH MẪU, CAO 2.5CM) */}
              {currentDntt.hinh_thuc_thanh_toan === 'Chuyển khoản' && (
                <tr style={{ height: '2.5cm' }}>
                  <td className="border border-black text-[12px] align-top" style={{ height: '2.5cm', padding: '4pt 8px' }} colSpan={2}>
                    <div className="font-bold underline mb-1 flex items-center gap-1">
                      <CreditCard size={13} className="text-[#D97706]" />
                      <span>Thông tin chuyển khoản:</span>
                    </div>
                    <div className="space-y-0.5 pl-1">
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-black text-xs font-bold">Tên tài khoản:</span>
                        <input
                          type="text"
                          placeholder="[...]"
                          value={currentDntt.ten_tai_khoan || ''}
                          onChange={(e) => setCurrentDntt(p => ({ ...p, ten_tai_khoan: e.target.value }))}
                          className="flex-1 border-b border-dotted border-gray-400 px-1 py-0.5 bg-transparent focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-black text-xs font-bold">Số tài khoản:</span>
                        <input
                          type="text"
                          placeholder="[...]"
                          value={currentDntt.so_tai_khoan || ''}
                          onChange={(e) => setCurrentDntt(p => ({ ...p, so_tai_khoan: e.target.value }))}
                          className="flex-1 border-b border-dotted border-gray-400 px-1 py-0.5 bg-transparent font-mono focus:outline-none focus:border-blue-600"
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
            <div className="flex items-center justify-end gap-1.5 italic text-[12.5px] text-gray-800 mb-2 flex-wrap">
              <input
                type="text"
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

            <table className="w-full border-collapse border-none text-center">
              <thead>
                <tr>
                  <th className="w-1/4 py-1 font-bold text-center text-black text-[12.5px]">
                    <input
                      type="text"
                      value={currentDntt.ky_chuc_danh_1 || 'Phê duyệt'}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_chuc_danh_1: e.target.value }))}
                      className="w-full text-center font-bold text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none transition-colors"
                      title="Bấm để chỉnh sửa chức danh"
                    />
                  </th>
                  <th className="w-1/4 py-1 font-bold text-center text-black text-[12.5px]">
                    <input
                      type="text"
                      value={currentDntt.ky_chuc_danh_2 || 'Kế toán - Tài chính'}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_chuc_danh_2: e.target.value }))}
                      className="w-full text-center font-bold text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none transition-colors"
                      title="Bấm để chỉnh sửa chức danh"
                    />
                  </th>
                  <th className="w-1/4 py-1 font-bold text-center text-black text-[12.5px]">
                    <input
                      type="text"
                      value={currentDntt.ky_chuc_danh_3 || 'Trưởng bộ phận'}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_chuc_danh_3: e.target.value }))}
                      className="w-full text-center font-bold text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none transition-colors"
                      title="Bấm để chỉnh sửa chức danh"
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
                      placeholder="[Gõ họ và tên]"
                      value={currentDntt.ky_ho_ten_1 || ''}
                      onChange={(e) => setCurrentDntt(p => ({ ...p, ky_ho_ten_1: e.target.value }))}
                      className="w-full text-center text-black bg-transparent border-b border-dashed border-gray-300 hover:border-[#D97706] focus:border-[#D97706] focus:outline-none text-[12px] placeholder:italic placeholder:text-gray-400 font-semibold"
                      title="Gõ họ và tên người phê duyệt"
                    />
                  </td>
                  <td className="text-center text-[12px] px-1">
                    <input
                      type="text"
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
      />
    </div>
  );
}
