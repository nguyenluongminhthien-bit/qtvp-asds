import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Plus, Trash2, CheckCircle2, AlertTriangle, 
  Layers, Calendar, Calculator, Star, Lock
} from 'lucide-react';
import { DnttChiTiet, DnttPhanBo, DmKmp, DmBoPhan, BoPhanCap1, BoPhanCap2, ChiPhiChotKy } from '../../types';
import { toast } from '../../utils/toast';
import { getCostGroupStyle } from '../../utils/costGroupColors';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  parentItem: DnttChiTiet | null;
  allocations: DnttPhanBo[];
  onSaveAllocations: (itemId: string, updated: DnttPhanBo[]) => void;
  kmpList: DmKmp[];
  boPhanList?: DmBoPhan[];
  cap1List: BoPhanCap1[];
  cap2List: BoPhanCap2[];
  unitId?: string | null;
  chotKyList?: ChiPhiChotKy[];
  isDnttUnlocked?: boolean;
}

/**
 * Tự động làm tròn và cân đối số tiền phân bổ khi kiểu nhập là % và tổng tỷ lệ đạt đúng 100%.
 * Giúp triệt tiêu độ lệch làm tròn 1-2 VNĐ với số tiền dòng nội dung gốc đang so sánh (parentAmount).
 */
function balanceAllocationRows(rows: DnttPhanBo[], parentAmount: number): DnttPhanBo[] {
  if (!rows || rows.length === 0 || parentAmount <= 0) return rows;

  // Tính tổng % của tất cả các dòng
  const totalPercent = rows.reduce((sum, r) => sum + (Number(r.phan_tram) || 0), 0);

  // Điều kiện: tổng lại phải đúng là 100% (xử lý sai số làm tròn float trong JS)
  const isExact100Percent = Math.abs(totalPercent - 100) < 0.001 || Math.round(totalPercent * 100) === 10000;

  // Nếu chưa đạt đúng 100%, giữ nguyên các dòng
  if (!isExact100Percent) {
    return rows;
  }

  // 1. Tính toán lại số tiền cơ sở cho các dòng có kieu_nhap === 'PHAN_TRAM'
  const updated = rows.map(r => {
    if (r.kieu_nhap === 'PHAN_TRAM') {
      const pct = Number(r.phan_tram) || 0;
      return {
        ...r,
        so_tien: Math.round((pct / 100) * parentAmount)
      };
    }
    return { ...r };
  });

  // 2. Tính tổng số tiền phân bổ và độ lệch so với parentAmount
  const currentTotal = updated.reduce((sum, r) => sum + (Number(r.so_tien) || 0), 0);
  const diff = parentAmount - currentTotal;

  // Đã khớp hoàn toàn (diff === 0)
  if (diff === 0) return updated;

  // 3. Nếu còn lệch (thường là 1-2 VNĐ do làm tròn):
  // Ưu tiên bù trừ vào dòng cuối cùng có kieu_nhap === 'PHAN_TRAM' và phan_tram > 0
  let targetIndex = -1;
  for (let i = updated.length - 1; i >= 0; i--) {
    if (updated[i].kieu_nhap === 'PHAN_TRAM' && (Number(updated[i].phan_tram) || 0) > 0) {
      if ((Number(updated[i].so_tien) || 0) + diff > 0) {
        targetIndex = i;
        break;
      }
    }
  }

  // Dự phòng: nếu không tìm thấy dòng % thỏa điều kiện, tìm dòng có số tiền lớn nhất
  if (targetIndex === -1) {
    let maxAmt = -Infinity;
    for (let i = 0; i < updated.length; i++) {
      const amt = Number(updated[i].so_tien) || 0;
      if (amt > maxAmt && amt + diff > 0) {
        maxAmt = amt;
        targetIndex = i;
      }
    }
  }

  if (targetIndex !== -1) {
    updated[targetIndex] = {
      ...updated[targetIndex],
      so_tien: (Number(updated[targetIndex].so_tien) || 0) + diff
    };
  }

  return updated;
}

export default function DnttAllocationModal({
  isOpen,
  onClose,
  parentItem,
  allocations,
  onSaveAllocations,
  kmpList,
  boPhanList,
  cap1List,
  cap2List,
  unitId,
  chotKyList = [],
  isDnttUnlocked = false
}: Props) {
  const [rows, setRows] = useState<DnttPhanBo[]>([]);
  const [selectedKmpId, setSelectedKmpId] = useState<string>('');
  const [selectedThang, setSelectedThang] = useState<number>(new Date().getMonth() + 1);
  const [selectedNam, setSelectedNam] = useState<number>(new Date().getFullYear());
  const parentAmount = parentItem ? Number(parentItem.so_tien) || 0 : 0;

  // Lọc danh mục bộ phận theo đơn vị của phiếu ĐNTT hiện tại (fallback mẫu chung)
  const effectiveBoPhanList = useMemo(() => {
    if (!boPhanList || boPhanList.length === 0) return [];
    if (unitId) {
      const specific = boPhanList.filter(b => {
        if (b.active === false || !b.id_don_vi) return false;
        const ids = String(b.id_don_vi).split(',').map(s => s.trim()).filter(Boolean);
        return ids.includes(String(unitId));
      });
      if (specific.length > 0) return specific;
    }
    const common = boPhanList.filter(b => !b.id_don_vi && b.active !== false);
    return common.length > 0 ? common : boPhanList.filter(b => b.active !== false);
  }, [boPhanList, unitId]);

  // Danh sách Khối / Nghiệp vụ
  const uniqueKhoiList = useMemo(() => {
    if (effectiveBoPhanList && effectiveBoPhanList.length > 0) {
      const map = new Map<string, string>();
      effectiveBoPhanList.filter(b => b.active !== false).forEach(b => {
        if (!map.has(b.ma_cap1)) {
          map.set(b.ma_cap1, b.ten_cap1);
        }
      });
      return Array.from(map.entries()).map(([ma, ten]) => ({ ma, ten }));
    }
    return cap1List.filter(c => c.active !== false).map(c => ({ ma: c.id || c.ma, ten: c.ten }));
  }, [effectiveBoPhanList, cap1List]);

  // Kiểm tra xem kỳ (Tháng/Năm) đã chọn có bị chốt số liệu đóng băng cho đơn vị hiện tại hay không
  const isPeriodLocked = useMemo(() => {
    // Nếu phiếu ĐNTT đang được Admin đặc cách mở khóa trực tiếp -> không bị khóa
    if (isDnttUnlocked) return false;
    if (!chotKyList || chotKyList.length === 0) return false;

    return chotKyList.some(ck => {
      if (ck.trang_thai !== 'da_chot') return false;
      if (Number(ck.thang) !== Number(selectedThang) || Number(ck.nam) !== Number(selectedNam)) return false;

      // Kiểm tra thời hạn gia hạn mở khóa (nếu có mốc thời gian han_mo_khoa)
      const isExtensionActive = !ck.han_mo_khoa || new Date() <= new Date(ck.han_mo_khoa);

      if (isExtensionActive) {
        // Nếu mở khóa toàn bộ cho kỳ này
        if (ck.mo_khoa_toan_bo) return false;

        // NGOẠI LỆ: Nếu đơn vị nằm trong danh sách mở khóa ngoại lệ của kỳ chốt này -> Không khóa!
        if (unitId && ck.danh_sach_don_vi_mo_khoa && ck.danh_sach_don_vi_mo_khoa.some(uId => String(uId) === String(unitId))) {
          return false;
        }
      }

      // Phạm vi đơn vị: Nếu chốt toàn quốc ('ALL') hoặc đơn vị này nằm trong danh sách chốt
      if (!ck.id_don_vi || ck.id_don_vi === 'ALL') return true;
      if (!unitId) return false;
      if (String(ck.id_don_vi) === String(unitId)) return true;
      if (ck.danh_sach_don_vi_ap_dung && ck.danh_sach_don_vi_ap_dung.includes(String(unitId))) return true;
      return false;
    });
  }, [isDnttUnlocked, chotKyList, selectedThang, selectedNam, unitId]);

  // Phân nhóm Khoản mục phí theo Nhóm chi phí
  const groupedKmp = useMemo(() => {
    const map = new Map<string, DmKmp[]>();
    kmpList.forEach(k => {
      if (k.active === false) return;
      const grp = k.nhom_chi_phi?.trim() || 'Chi phí khác';
      if (!map.has(grp)) map.set(grp, []);
      map.get(grp)!.push(k);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [kmpList]);

  // Khởi tạo và đồng bộ dữ liệu khi mở modal
  useEffect(() => {
    if (isOpen && parentItem) {
      if (allocations && allocations.length > 0) {
        // Lấy KMP và Kỳ từ dòng phân bổ đầu tiên
        const firstWithKmp = allocations.find(a => a.id_kmp) || allocations[0];
        const kmpId = firstWithKmp?.id_kmp || kmpList.find(k => k.active !== false)?.id || '';
        const thangVal = firstWithKmp?.thang || (new Date().getMonth() + 1);
        const namVal = firstWithKmp?.nam || new Date().getFullYear();

        setSelectedKmpId(kmpId);
        setSelectedThang(thangVal);
        setSelectedNam(namVal);

        // Đảm bảo tất cả các dòng đều đồng bộ theo KMP và Kỳ đã chọn
        const synced = allocations.map(a => ({
          ...a,
          id_kmp: kmpId,
          thang: thangVal,
          nam: namVal
        }));
        setRows(balanceAllocationRows(synced, parentAmount));
      } else {
        // Mặc định tạo 1 dòng đầu tiên với 100% số tiền
        const defaultKmp = kmpList.find(k => k.active !== false)?.id || '';
        const now = new Date();
        const thangVal = now.getMonth() + 1;
        const namVal = now.getFullYear();

        setSelectedKmpId(defaultKmp);
        setSelectedThang(thangVal);
        setSelectedNam(namVal);

        let defaultCap1 = '';
        let defaultCap2: string | undefined = undefined;
        let defaultIdBoPhan: string | undefined = undefined;

        if (effectiveBoPhanList && effectiveBoPhanList.length > 0) {
          const activeBp = effectiveBoPhanList.find(b => b.active !== false);
          if (activeBp) {
            defaultCap1 = activeBp.ma_cap1;
            defaultCap2 = activeBp.ma_cap2;
            defaultIdBoPhan = activeBp.id;
          }
        } else {
          defaultCap1 = cap1List.find(c => c.active !== false)?.id || '';
        }

        setRows([
          {
            id: `PB_${Date.now()}_1`,
            dntt_id: parentItem.dntt_id,
            dntt_chi_tiet_id: parentItem.id,
            kieu_nhap: 'SO_TIEN',
            phan_tram: 100,
            so_tien: parentAmount,
            id_kmp: defaultKmp,
            thang: thangVal,
            nam: namVal,
            id_bo_phan: defaultIdBoPhan,
            id_bo_phan_cap1: defaultCap1,
            id_bo_phan_cap2: defaultCap2,
            thu_tu: 1,
            ghi_chu: ''
          }
        ]);
      }
    }
  }, [isOpen, parentItem, allocations, kmpList, cap1List, effectiveBoPhanList, parentAmount]);

  // Đồng bộ KMP cho toàn bộ các dòng phân bổ con
  const handleKmpChange = (newKmpId: string) => {
    setSelectedKmpId(newKmpId);
    setRows(prev => prev.map(r => ({ ...r, id_kmp: newKmpId })));
  };

  // Đồng bộ Tháng cho toàn bộ các dòng phân bổ con
  const handleThangChange = (newThang: number) => {
    setSelectedThang(newThang);
    setRows(prev => prev.map(r => ({ ...r, thang: newThang })));
  };

  // Đồng bộ Năm cho toàn bộ các dòng phân bổ con
  const handleNamChange = (newNam: number) => {
    setSelectedNam(newNam);
    setRows(prev => prev.map(r => ({ ...r, nam: newNam })));
  };

  // Tổng tiền đã phân bổ
  const totalAllocated = useMemo(() => {
    return rows.reduce((acc, r) => acc + (Number(r.so_tien) || 0), 0);
  }, [rows]);

  // Chênh lệch: Dòng cha - Tổng phân bổ
  const difference = useMemo(() => {
    return parentAmount - totalAllocated;
  }, [parentAmount, totalAllocated]);

  const isMatched = Math.abs(difference) === 0;

  if (!isOpen || !parentItem) return null;

  // Thêm dòng phân bổ mới (kế thừa KMP & Kỳ từ lựa chọn chung ở đầu bảng)
  const handleAddRow = () => {
    const remainingAmount = difference > 0 ? difference : 0;
    const remainingPercent = parentAmount > 0 ? Number(((remainingAmount / parentAmount) * 100).toFixed(2)) : 0;

    if (rows.length > 0) {
      const prevRow = rows[rows.length - 1];
      const newRow: DnttPhanBo = {
        id: `PB_${Date.now()}_${rows.length + 1}`,
        dntt_id: parentItem.dntt_id,
        dntt_chi_tiet_id: parentItem.id,
        kieu_nhap: prevRow.kieu_nhap,
        phan_tram: remainingPercent,
        so_tien: remainingAmount,
        id_kmp: selectedKmpId,
        thang: selectedThang,
        nam: selectedNam,
        id_bo_phan: prevRow.id_bo_phan,
        id_bo_phan_cap1: prevRow.id_bo_phan_cap1,
        id_bo_phan_cap2: prevRow.id_bo_phan_cap2,
        thu_tu: rows.length + 1,
        ghi_chu: prevRow.ghi_chu || ''
      };
      setRows(p => balanceAllocationRows([...p, newRow], parentAmount));
      return;
    }

    let defaultCap1 = '';
    let defaultCap2: string | undefined = undefined;
    let defaultIdBoPhan: string | undefined = undefined;

    if (effectiveBoPhanList && effectiveBoPhanList.length > 0) {
      const activeBp = effectiveBoPhanList.find(b => b.active !== false);
      if (activeBp) {
        defaultCap1 = activeBp.ma_cap1;
        defaultCap2 = activeBp.ma_cap2;
        defaultIdBoPhan = activeBp.id;
      }
    } else {
      defaultCap1 = cap1List.find(c => c.active !== false)?.id || '';
    }

    const newRow: DnttPhanBo = {
      id: `PB_${Date.now()}_1`,
      dntt_id: parentItem.dntt_id,
      dntt_chi_tiet_id: parentItem.id,
      kieu_nhap: 'SO_TIEN',
      phan_tram: remainingPercent,
      so_tien: remainingAmount,
      id_kmp: selectedKmpId,
      thang: selectedThang,
      nam: selectedNam,
      id_bo_phan: defaultIdBoPhan,
      id_bo_phan_cap1: defaultCap1,
      id_bo_phan_cap2: defaultCap2,
      thu_tu: 1,
      ghi_chu: ''
    };

    setRows([newRow]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) {
      toast.warning('Cần ít nhất 1 dòng phân bổ cho nội dung thanh toán này!');
      return;
    }
    setRows(p => balanceAllocationRows(p.filter((_, i) => i !== index), parentAmount));
  };

  const handleChangeRow = (index: number, field: keyof DnttPhanBo, value: any) => {
    setRows(prev => {
      const clone = [...prev];
      const row = { ...clone[index], [field]: value };

      // Nếu đổi kiểu nhập hoặc đổi giá trị %
      if (field === 'phan_tram') {
        const pct = Number(value) || 0;
        row.phan_tram = pct;
        row.so_tien = Math.round((pct / 100) * parentAmount);
      } else if (field === 'so_tien') {
        const amt = Number(value) || 0;
        row.so_tien = amt;
        row.phan_tram = parentAmount > 0 ? Number(((amt / parentAmount) * 100).toFixed(2)) : 0;
      } else if (field === 'kieu_nhap') {
        if (value === 'PHAN_TRAM') {
          // Tính lại theo %
          const pct = row.phan_tram || (parentAmount > 0 ? Number(((row.so_tien / parentAmount) * 100).toFixed(2)) : 0);
          row.phan_tram = pct;
          row.so_tien = Math.round((pct / 100) * parentAmount);
        }
      } else if (field === 'id_bo_phan_cap1') {
        row.id_bo_phan_cap1 = value;
        if (effectiveBoPhanList && effectiveBoPhanList.length > 0) {
          const childOptions = effectiveBoPhanList.filter(b => b.active !== false && b.ma_cap1 === value);
          if (childOptions.length === 1) {
            row.id_bo_phan = childOptions[0].id;
            row.id_bo_phan_cap2 = childOptions[0].ma_cap2;
          } else {
            row.id_bo_phan = undefined;
            row.id_bo_phan_cap2 = undefined;
          }
        } else {
          const targetCap1 = cap1List.find(c => c.id === value);
          if (!targetCap1?.yeu_cau_cap2) {
            row.id_bo_phan_cap2 = undefined;
          }
        }
      } else if (field === 'id_bo_phan_cap2') {
        if (effectiveBoPhanList && effectiveBoPhanList.length > 0) {
          const found = effectiveBoPhanList.find(b => b.id === value || (b.ma_cap1 === row.id_bo_phan_cap1 && b.ma_cap2 === value));
          if (found) {
            row.id_bo_phan = found.id;
            row.id_bo_phan_cap2 = found.ma_cap2;
            row.id_bo_phan_cap1 = found.ma_cap1;
          } else {
            row.id_bo_phan = undefined;
            row.id_bo_phan_cap2 = value;
          }
        } else {
          row.id_bo_phan_cap2 = value;
        }
      }

      clone[index] = row;
      return balanceAllocationRows(clone, parentAmount);
    });
  };

  // Chia đều số tiền cho tất cả các dòng
  const handleDivideEqually = () => {
    if (rows.length === 0 || parentAmount <= 0) return;
    const count = rows.length;
    const baseAmount = Math.floor(parentAmount / count);
    const remainder = parentAmount - (baseAmount * count);

    setRows(prev => prev.map((r, i) => {
      const amt = i === 0 ? baseAmount + remainder : baseAmount;
      return {
        ...r,
        kieu_nhap: 'SO_TIEN',
        so_tien: amt,
        phan_tram: Number(((amt / parentAmount) * 100).toFixed(2))
      };
    }));
    toast.success('Đã chia đều số tiền cho các dòng phân bổ!');
  };

  const handleSave = () => {
    if (!selectedKmpId) {
      toast.warning('Vui lòng chọn Khoản mục phí (KMP) cho nội dung thanh toán!');
      return;
    }

    // Cân đối làm tròn để đảm bảo độ chính xác tuyệt đối trước khi lưu
    const balancedRows = balanceAllocationRows(rows, parentAmount);

    // Kiểm tra hợp lệ từng dòng
    for (let i = 0; i < balancedRows.length; i++) {
      const r = balancedRows[i];
      if (!r.id_bo_phan_cap1) {
        toast.warning(`Dòng ${i + 1}: Vui lòng chọn Khối / Nghiệp vụ!`);
        return;
      }
      if (effectiveBoPhanList && effectiveBoPhanList.length > 0) {
        const availableCap2 = effectiveBoPhanList.filter(b => b.active !== false && b.ma_cap1 === r.id_bo_phan_cap1);
        if (availableCap2.length > 0 && !r.id_bo_phan && !r.id_bo_phan_cap2) {
          toast.warning(`Dòng ${i + 1}: Vui lòng chọn Thương hiệu / Phòng / Bộ phận!`);
          return;
        }
      } else {
        const cap1 = cap1List.find(c => c.id === r.id_bo_phan_cap1);
        if (cap1?.yeu_cau_cap2 && !r.id_bo_phan_cap2) {
          toast.warning(`Dòng ${i + 1}: Bộ phận "${cap1.ten}" bắt buộc chọn Thương hiệu / Phòng / Bộ phận!`);
          return;
        }
      }
      if (Number(r.so_tien) <= 0) {
        toast.warning(`Dòng ${i + 1}: Số tiền phân bổ phải lớn hơn 0!`);
        return;
      }
    }

    const currentTotalAlloc = balancedRows.reduce((acc, r) => acc + (Number(r.so_tien) || 0), 0);
    const currentDiff = parentAmount - currentTotalAlloc;

    if (isPeriodLocked) {
      toast.error(`Kỳ chi phí Tháng ${String(selectedThang).padStart(2, '0')}/${selectedNam} đã được Admin chốt số liệu đóng băng. Vui lòng phân bổ sang kỳ chi phí mở/chưa chốt!`);
      return;
    }

    if (Math.abs(currentDiff) !== 0) {
      toast.error(`Tổng số tiền phân bổ chưa khớp (Chênh lệch: ${Math.round(currentDiff).toLocaleString('vi-VN')} VNĐ). Vui lòng điều chỉnh để chênh lệch bằng 0 trước khi lưu!`);
      return;
    }

    // Đánh lại số thứ tự và đảm bảo id_kmp, thang, nam đồng bộ
    const finalized = balancedRows.map((r, i) => ({
      ...r,
      id_kmp: selectedKmpId,
      thang: selectedThang,
      nam: selectedNam,
      thu_tu: i + 1
    }));
    onSaveAllocations(parentItem.id, finalized);
    toast.success('Đã lưu phân bổ chi phí cho dòng nội dung này!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#D97706] to-[#b45309] text-white flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-white/20">
                STT {parentItem.stt}
              </span>
              <h3 className="text-base sm:text-lg font-black tracking-tight">
                Phân bổ chi phí chi tiết theo dòng nội dung
              </h3>
            </div>
            <p className="text-xs text-amber-100 mt-1 max-w-2xl truncate">
              <strong>Nội dung:</strong> {parentItem.noi_dung}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Real-time Status / Total Diff Card */}
        <div className="p-3 sm:p-4 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 shadow-xs">
            <span className="text-[11px] font-bold text-gray-500 uppercase">Số tiền dòng nội dung gốc</span>
            <div className="text-base sm:text-lg font-black text-gray-900 dark:text-gray-100 font-mono">
              {parentAmount.toLocaleString('vi-VN')} <span className="text-xs font-normal">VNĐ</span>
            </div>
          </div>

          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 shadow-xs">
            <span className="text-[11px] font-bold text-gray-500 uppercase">Tổng tiền đã phân bổ</span>
            <div className="text-base sm:text-lg font-black text-[#D97706] font-mono">
              {totalAllocated.toLocaleString('vi-VN')} <span className="text-xs font-normal">VNĐ</span>
            </div>
          </div>

          <div className={`p-2.5 rounded-xl border shadow-xs transition-all ${
            isMatched 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300' 
              : 'bg-red-50 dark:bg-red-950/40 border-red-300 text-red-700 dark:text-red-300'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase">Chênh lệch (Phải = 0)</span>
              {isMatched ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-red-600 animate-pulse" />}
            </div>
            <div className="text-base sm:text-lg font-black font-mono">
              {difference.toLocaleString('vi-VN')} <span className="text-xs font-normal">VNĐ</span>
            </div>
          </div>
        </div>

        {/* Lựa chọn KMP & Kỳ (T/N) dùng chung cho toàn bộ dòng nội dung */}
        <div className="p-3 sm:p-4 bg-amber-50/40 dark:bg-slate-700/30 border-b border-amber-200/60 dark:border-slate-700 grid grid-cols-1 md:grid-cols-12 gap-3 shrink-0 items-start">
          {/* Cột trái: Khoản mục phí (KMP) */}
          <div className="md:col-span-8 p-3 bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-slate-600 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Layers size={14} className="text-[#D97706]" />
                Khoản mục phí (KMP) áp dụng chung <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-gray-500 italic hidden sm:inline">
                Chỉ chọn 1 lần cho tất cả các dòng con
              </span>
            </div>

            <select
              required
              value={selectedKmpId}
              onChange={(e) => handleKmpChange(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs text-gray-900 dark:text-gray-100 font-semibold focus:ring-2 focus:ring-[#D97706] focus:border-[#D97706]"
            >
              <option value="">-- Chọn Khoản mục phí --</option>
              {groupedKmp.map(([groupName, items]) => (
                <optgroup key={groupName} label={`📂 ${groupName.toUpperCase()}`}>
                  {items.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.ma_b7 ? `${k.ma_b7} - ` : ''}{k.dien_giai || k.nhom_chi_phi} {k.trong_yeu ? '⭐' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* Nhãn chi tiết nhóm chi phí & trọng yếu */}
            {(() => {
              const currentKmp = kmpList.find(k => k.id === selectedKmpId);
              if (!currentKmp) return null;
              const style = getCostGroupStyle(currentKmp.nhom_chi_phi);
              return (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${style.badge}`}>
                    {currentKmp.nhom_chi_phi}
                  </span>
                  {currentKmp.trong_yeu && (
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Star size={12} className="fill-amber-500 text-amber-500" /> KMP Trọng yếu
                    </span>
                  )}
                  {currentKmp.ma_b7 && (
                    <span className="text-[11px] font-mono text-gray-500">
                      Mã B7: <strong>{currentKmp.ma_b7}</strong>
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Cột phải: Kỳ chi phí (Tháng / Năm) */}
          <div className="md:col-span-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-slate-600 shadow-2xs">
            <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 mb-1.5">
              <Calendar size={14} className="text-[#D97706]" />
              Kỳ chi phí (Tháng / Năm) <span className="text-red-500">*</span>
            </label>

            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1">
                <select
                  value={selectedThang}
                  onChange={(e) => handleThangChange(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs font-bold font-mono text-center text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#D97706]"
                >
                  {Array.from({ length: 12 }, (_, m) => (
                    <option key={m + 1} value={m + 1}>Tháng {m + 1}</option>
                  ))}
                </select>
              </div>

              <span className="text-gray-400 font-bold">/</span>

              <div className="w-24">
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={selectedNam}
                  onChange={(e) => handleNamChange(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs font-bold font-mono text-center text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#D97706]"
                />
              </div>
            </div>

            {/* Cảnh báo nếu kỳ chi phí đang chọn đã bị đóng băng */}
            {isPeriodLocked && (
              <div className="mt-2.5 flex items-center gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-200 text-[11px] font-bold">
                <Lock size={13} className="text-[#D97706] shrink-0" />
                <span>Kỳ Tháng {selectedThang}/{selectedNam} đã được Admin chốt số liệu đóng băng. Vui lòng chọn kỳ mở!</span>
              </div>
            )}

            <div className="text-[11px] text-gray-400 italic mt-2">
              Kỳ hạch toán cho các dòng phân bổ con
            </div>
          </div>
        </div>

        {/* Toolbar: Add row, Divide equally, Note */}
        <div className="p-3 px-4 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#D97706] hover:bg-[#b45309] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Thêm dòng phân bổ con</span>
            </button>

            {rows.length > 1 && (
              <button
                type="button"
                onClick={handleDivideEqually}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Calculator size={14} />
                <span>Chia đều ({rows.length} phần)</span>
              </button>
            )}
          </div>

          <div className="text-xs text-gray-500 italic">
            * Mỗi dòng con sẽ được in trực tiếp lên file DNTT ngay dưới dòng nội dung này.
          </div>
        </div>

        {/* Table of Sub-allocations */}
        <div className="flex-1 overflow-auto custom-scrollbar p-3 sm:p-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-bold border-b border-gray-200 dark:border-slate-600 z-10 text-[11px]">
              <tr>
                <th className="p-2.5 w-10 text-center font-bold">#</th>
                <th className="p-2.5 w-64 min-w-[200px] font-bold">Khối / Nghiệp vụ</th>
                <th className="p-2.5 min-w-[260px] font-bold">Thương hiệu / Phòng / Bộ phận</th>
                <th className="p-2.5 w-28 text-center font-bold">Kiểu nhập</th>
                <th className="p-2.5 w-24 text-right font-bold">Tỷ lệ %</th>
                <th className="p-2.5 w-36 text-right font-bold">Số tiền (VNĐ)</th>
                <th className="p-2.5 w-10 text-center font-bold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {rows.map((row, idx) => {
                const currentCap1 = cap1List.find(c => c.id === row.id_bo_phan_cap1);
                const requiresCap2 = !!currentCap1?.yeu_cau_cap2;

                return (
                  <tr key={row.id || idx} className="hover:bg-blue-50/30 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="p-2.5 text-center text-gray-400 font-mono font-bold">{idx + 1}</td>

                    {/* Khối / Nghiệp vụ */}
                    <td className="p-2.5">
                      <select
                        value={row.id_bo_phan_cap1}
                        onChange={(e) => handleChangeRow(idx, 'id_bo_phan_cap1', e.target.value)}
                        className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#D97706]"
                      >
                        <option value="">-- Chọn Khối / Nghiệp vụ --</option>
                        {uniqueKhoiList.map(k => (
                          <option key={k.ma} value={k.ma}>{k.ten}</option>
                        ))}
                      </select>
                    </td>

                    {/* Thương hiệu / Phòng / Bộ phận */}
                    <td className="p-2.5">
                      {effectiveBoPhanList && effectiveBoPhanList.length > 0 ? (
                        (() => {
                          const cap2Options = effectiveBoPhanList.filter(b => b.active !== false && b.ma_cap1 === row.id_bo_phan_cap1);
                          return (
                            <select
                              required
                              value={row.id_bo_phan || row.id_bo_phan_cap2 || ''}
                              onChange={(e) => handleChangeRow(idx, 'id_bo_phan_cap2', e.target.value || undefined)}
                              disabled={cap2Options.length === 0}
                              className={`w-full p-2 border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#D97706] ${
                                !row.id_bo_phan && !row.id_bo_phan_cap2
                                  ? 'border-amber-300 bg-amber-50/50 dark:bg-slate-700 text-amber-900 dark:text-amber-200'
                                  : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200'
                              }`}
                            >
                              <option value="">-- Chọn Thương hiệu / Phòng / Bộ phận --</option>
                              {cap2Options.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.ten_cap2} ({c.ma_cap2})
                                </option>
                              ))}
                            </select>
                          );
                        })()
                      ) : (
                        requiresCap2 ? (
                          <select
                            required
                            value={row.id_bo_phan_cap2 || ''}
                            onChange={(e) => handleChangeRow(idx, 'id_bo_phan_cap2', e.target.value || undefined)}
                            className="w-full p-2 border border-amber-300 dark:border-amber-600 rounded-lg bg-amber-50/50 dark:bg-slate-700 text-xs font-semibold text-amber-900 dark:text-amber-200 focus:ring-2 focus:ring-[#D97706]"
                          >
                            <option value="">-- Chọn Thương hiệu (Bắt buộc) --</option>
                            {cap2List.filter(c => c.active !== false).map(c => (
                              <option key={c.id} value={c.id}>{c.ten}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-400 italic px-2">Không yêu cầu Thương hiệu / Bộ phận</span>
                        )
                      )}
                    </td>

                    {/* Kiểu nhập */}
                    <td className="p-2.5 text-center">
                      <div className="inline-flex rounded-md shadow-2xs p-0.5 bg-gray-100 dark:bg-slate-700">
                        <button
                          type="button"
                          onClick={() => handleChangeRow(idx, 'kieu_nhap', 'SO_TIEN')}
                          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
                            row.kieu_nhap === 'SO_TIEN'
                              ? 'bg-white dark:bg-slate-800 text-[#D97706] shadow-2xs'
                              : 'text-gray-500'
                          }`}
                        >
                          Số tiền
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeRow(idx, 'kieu_nhap', 'PHAN_TRAM')}
                          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
                            row.kieu_nhap === 'PHAN_TRAM'
                              ? 'bg-white dark:bg-slate-800 text-[#D97706] shadow-2xs'
                              : 'text-gray-500'
                          }`}
                        >
                          %
                        </button>
                      </div>
                    </td>

                    {/* Tỷ lệ % */}
                    <td className="p-2.5">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          disabled={row.kieu_nhap === 'SO_TIEN'}
                          value={row.phan_tram || ''}
                          onChange={(e) => handleChangeRow(idx, 'phan_tram', e.target.value)}
                          className={`w-full p-2 pr-6 border rounded-lg text-xs font-mono text-right ${
                            row.kieu_nhap === 'PHAN_TRAM'
                              ? 'border-amber-400 bg-amber-50/50 font-bold text-[#D97706]'
                              : 'border-gray-200 bg-gray-50 text-gray-500'
                          }`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-bold">%</span>
                      </div>
                    </td>

                    {/* Số tiền */}
                    <td className="p-2.5">
                      <input
                        type="text"
                        disabled={row.kieu_nhap === 'PHAN_TRAM'}
                        placeholder="0"
                        value={row.so_tien ? Number(row.so_tien).toLocaleString('vi-VN') : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, '');
                          handleChangeRow(idx, 'so_tien', raw ? Number(raw) : 0);
                        }}
                        className={`w-full p-2 border rounded-lg text-xs font-mono text-right font-bold ${
                          row.kieu_nhap === 'SO_TIEN'
                            ? 'border-amber-400 bg-amber-50/50 text-[#D97706]'
                            : 'border-gray-200 bg-gray-50 text-gray-700'
                        }`}
                      />
                    </td>

                    {/* Nút xóa */}
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Xóa dòng phân bổ này"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {isMatched ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} />
                Số tiền phân bổ đã khớp 100% với dòng nội dung gốc!
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                <AlertTriangle size={16} />
                Chưa khớp! Chênh lệch: {Math.abs(difference).toLocaleString('vi-VN')} VNĐ (Cần đưa về 0 để lưu)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-semibold border border-gray-200 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={!isMatched || isPeriodLocked}
              onClick={handleSave}
              className={`px-5 py-2 text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all ${
                isMatched && !isPeriodLocked
                  ? 'bg-[#D97706] hover:bg-[#b45309] text-white cursor-pointer shadow-md active:scale-95'
                  : 'bg-gray-300 dark:bg-slate-600 text-gray-500 cursor-not-allowed opacity-60'
              }`}
              title={isPeriodLocked ? `Kỳ chi phí Tháng ${selectedThang}/${selectedNam} đã chốt — Không thể phân bổ` : undefined}
            >
              {isPeriodLocked ? 'Kỳ đã đóng băng' : 'Xác nhận phân bổ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
