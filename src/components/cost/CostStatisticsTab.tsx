import React, { useState, useMemo } from 'react';
import {
  BarChart2, Calendar, Filter, Download, Lock, Unlock, AlertCircle,
  TrendingUp, TrendingDown, CheckCircle2, ChevronDown, Layers,
  Building, RefreshCw, X, ShieldAlert, Sparkles, PieChart, FileSpreadsheet
} from 'lucide-react';
import {
  ChiPhiChotKy, ChiPhiThongKe, DNTT, DnttPhanBo, DmKmp,
  DmBoPhan, BoPhanCap1, BoPhanCap2, DonVi, PhapNhan
} from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../utils/toast';
import { getAllSubordinateIds } from '../../utils/hierarchy';

interface Props {
  thongKeList: ChiPhiThongKe[];
  chotKyList: ChiPhiChotKy[];
  dnttList: DNTT[];
  phanBoList: DnttPhanBo[];
  kmpList: DmKmp[];
  boPhanList?: DmBoPhan[];
  cap1List: BoPhanCap1[];
  cap2List: BoPhanCap2[];
  donViList: DonVi[];
  phapNhanList: PhapNhan[];
  selectedUnitFilter: string | null;
  onRefresh: () => Promise<void>;
  loading: boolean;
}

type DimensionType =
  | 'don_vi_phan_loai'
  | 'mien'
  | 'don_vi_quan_tri'
  | 'phap_nhan_mst'
  | 'showroom'
  | 'khoi_nghiep_vu'
  | 'bo_phan_thuong_hieu';

type PeriodType = 'thang' | 'quy' | '6thang' | 'nam';

export default function CostStatisticsTab({
  thongKeList,
  chotKyList,
  dnttList,
  phanBoList,
  kmpList,
  boPhanList = [],
  cap1List,
  cap2List,
  donViList,
  phapNhanList,
  selectedUnitFilter,
  onRefresh,
  loading
}: Props) {
  const { user } = useAuth();

  // 1. STATE BỘ LỌC
  const now = new Date();
  const [dimension, setDimension] = useState<DimensionType>('don_vi_phan_loai');
  const [periodType, setPeriodType] = useState<PeriodType>('thang');
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil((now.getMonth() + 1) / 3));
  const [selectedHalf, setSelectedHalf] = useState<1 | 2>(now.getMonth() + 1 <= 6 ? 1 : 2);
  const [selectedKmpId, setSelectedKmpId] = useState<string>('ALL');
  // Lọc theo trạng thái phiếu DNTT khi xem kỳ chưa chốt: 'ALL' (Tất cả DNTT) hoặc 'PAID' (Chỉ DNTT đã thanh toán)
  const [dnttStatusFilter, setDnttStatusFilter] = useState<'ALL' | 'PAID'>('ALL');

  // Đơn vị được lọc từ thanh bên ngoài
  const allowedUnitIds = useMemo(() => {
    if (!selectedUnitFilter || selectedUnitFilter === 'ALL') return null;
    return new Set([selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, donViList)]);
  }, [selectedUnitFilter, donViList]);

  // Nhóm KMP theo nhóm chi phí
  const groupedKmp = useMemo(() => {
    const map = new Map<string, DmKmp[]>();
    kmpList.forEach(k => {
      const group = k.nhom_chi_phi || 'Khác';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(k);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [kmpList]);

  // Modal Quản lý Chốt kỳ
  const [chotKyModalOpen, setChotKyModalOpen] = useState(false);
  const [chotKySubmitting, setChotKySubmitting] = useState(false);
  const [newChotThang, setNewChotThang] = useState<number>(now.getMonth() + 1);
  const [newChotNam, setNewChotNam] = useState<number>(now.getFullYear());
  const [newChotGhiChu, setNewChotGhiChu] = useState<string>('');
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  // 2. MAPPING DICTIONARIES
  const donViMap = useMemo(() => new Map(donViList.map(d => [String(d.id), d])), [donViList]);
  const phapNhanMap = useMemo(() => new Map(phapNhanList.map(p => [String(p.id), p])), [phapNhanList]);
  const kmpMap = useMemo(() => new Map(kmpList.map(k => [String(k.id), k])), [kmpList]);
  const cap1Map = useMemo(() => new Map(cap1List.map(c => [String(c.id), c])), [cap1List]);
  const cap2Map = useMemo(() => new Map(cap2List.map(c => [String(c.id), c])), [cap2List]);

  // Map MST -> Đại diện Pháp nhân
  const mstRepresentativeMap = useMemo(() => {
    const map = new Map<string, string>();
    phapNhanList.forEach(pn => {
      const mst = (pn.ma_so_thue || '').trim();
      if (mst && !map.has(mst)) {
        map.set(mst, pn.ten_cong_ty || pn.ten_phap_nhan || 'Chưa đặt tên');
      }
    });
    return map;
  }, [phapNhanList]);

  // 3. XÁC ĐỊNH DANH SÁCH THÁNG CHO KỲ NÀY VÀ KỲ TRƯỚC (CÙNG KỲ NĂM TRƯỚC)
  const { currentPeriodMonths, prevPeriodMonths, periodLabel, prevPeriodLabel } = useMemo(() => {
    let currMonths: number[] = [];
    let label = '';
    let prevLabel = '';

    if (periodType === 'thang') {
      currMonths = [selectedMonth];
      label = `Tháng ${selectedMonth}/${selectedYear}`;
      prevLabel = `Tháng ${selectedMonth}/${selectedYear - 1}`;
    } else if (periodType === 'quy') {
      if (selectedQuarter === 1) currMonths = [1, 2, 3];
      else if (selectedQuarter === 2) currMonths = [4, 5, 6];
      else if (selectedQuarter === 3) currMonths = [7, 8, 9];
      else currMonths = [10, 11, 12];
      label = `Quý ${selectedQuarter}/${selectedYear}`;
      prevLabel = `Quý ${selectedQuarter}/${selectedYear - 1}`;
    } else if (periodType === '6thang') {
      currMonths = selectedHalf === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
      label = `6 tháng ${selectedHalf === 1 ? 'đầu năm' : 'cuối năm'} ${selectedYear}`;
      prevLabel = `6 tháng ${selectedHalf === 1 ? 'đầu năm' : 'cuối năm'} ${selectedYear - 1}`;
    } else {
      currMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      label = `Năm ${selectedYear}`;
      prevLabel = `Năm ${selectedYear - 1}`;
    }

    return {
      currentPeriodMonths: currMonths,
      prevPeriodMonths: currMonths,
      periodLabel: label,
      prevPeriodLabel: prevLabel
    };
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, selectedHalf]);

  // Kiểm tra tình trạng chốt kỳ của các tháng trong kỳ này
  const closedMonthsCurrentPeriod = useMemo(() => {
    const closed = new Set<number>();
    currentPeriodMonths.forEach(m => {
      const isClosed = chotKyList.some(ck => ck.nam === selectedYear && ck.thang === m && ck.trang_thai === 'da_chot');
      if (isClosed) closed.add(m);
    });
    return closed;
  }, [currentPeriodMonths, selectedYear, chotKyList]);

  // 4. HÀM TRÍCH XUẤT NHÃN CHIỀU PHÂN TÍCH (SINGLE DIMENSION)
  const getDimensionKeyAndLabel = (
    donViId?: string,
    phapNhanId?: string,
    maSoThue?: string,
    cap1Id?: string,
    cap2Id?: string
  ): { key: string; label: string } => {
    const dv = donViId ? donViMap.get(String(donViId)) : null;

    if (dimension === 'don_vi_phan_loai') {
      // 1. Phân loại đơn vị: VPĐH hay CTTT (dựa trên cột phia hoặc loai_hinh có sẵn trong dm_don_vi)
      const isVpdh = dv?.phia === 'VPĐH' || dv?.loai_hinh === 'Văn phòng' || dv?.cap_quan_ly === 'HO' || dv?.cap_quan_ly === 'DV_HO';
      if (isVpdh) return { key: 'VPDH', label: 'Văn phòng Điều hành (VPĐH)' };
      return { key: 'CTTT', label: 'Công ty Tỉnh thành (CTTT)' };
    }

    if (dimension === 'mien') {
      // 2. Miền: Phía Bắc / Phía Nam / VPĐH
      if (dv?.phia === 'CTTT Phía Bắc') return { key: 'BAC', label: 'Phía Bắc' };
      if (dv?.phia === 'CTTT Phía Nam') return { key: 'NAM', label: 'Phía Nam' };
      if (dv?.phia === 'VPĐH') return { key: 'VPDH', label: 'Văn phòng Điều hành' };
      return { key: 'KHAC', label: 'Chưa phân miền' };
    }

    if (dimension === 'don_vi_quan_tri') {
      // 3. Đơn vị quản trị (Công ty Tỉnh thành)
      if (!dv) return { key: 'UNKNOWN', label: 'Không xác định đơn vị' };
      if (dv.loai_hinh === 'Công ty Tỉnh thành') {
        return { key: String(dv.id), label: dv.ten_don_vi };
      }
      if (dv.cap_quan_ly && dv.cap_quan_ly !== 'HO' && dv.cap_quan_ly !== 'DV_HO') {
        const parent = donViMap.get(String(dv.cap_quan_ly));
        if (parent) return { key: String(parent.id), label: parent.ten_don_vi };
      }
      return { key: String(dv.id), label: dv.ten_don_vi };
    }

    if (dimension === 'phap_nhan_mst') {
      // 4. Pháp nhân: gom nhóm theo Mã số thuế thật để xử lý triệt để trùng lặp pháp nhân
      let mst = (maSoThue || '').trim();
      let repName = '';
      if (!mst && phapNhanId) {
        const pn = phapNhanMap.get(String(phapNhanId));
        if (pn?.ma_so_thue) mst = pn.ma_so_thue.trim();
        if (pn?.ten_cong_ty || pn?.ten_phap_nhan) repName = pn.ten_cong_ty || pn.ten_phap_nhan || '';
      }
      if (!mst) return { key: 'NO_MST', label: 'Không có Mã số thuế' };
      if (!repName) repName = mstRepresentativeMap.get(mst) || 'Pháp nhân chưa đặt tên';
      return { key: mst, label: `${mst} - ${repName}` };
    }

    if (dimension === 'showroom') {
      // 5. Showroom
      if (!dv) return { key: 'UNKNOWN', label: 'Không xác định đơn vị' };
      if (dv.loai_hinh === 'Showroom' || (dv.cap_quan_ly && dv.cap_quan_ly !== 'HO' && dv.cap_quan_ly !== 'DV_HO')) {
        return { key: String(dv.id), label: dv.ten_don_vi };
      }
      return { key: String(dv.id), label: `[Cơ sở] ${dv.ten_don_vi}` };
    }

    if (dimension === 'khoi_nghiep_vu') {
      // 6. Khối / Nghiệp vụ (Cấp 1)
      if (!cap1Id) return { key: 'NO_CAP1', label: 'Chưa phân loại Khối' };
      const c1 = cap1Map.get(String(cap1Id));
      return { key: String(cap1Id), label: c1 ? c1.ten : `Khối: ${cap1Id}` };
    }

    if (dimension === 'bo_phan_thuong_hieu') {
      // 7. Bộ phận / Thương hiệu (Cấp 2)
      if (!cap2Id) return { key: 'NO_CAP2', label: 'Chưa phân loại Thương hiệu' };
      const c2 = cap2Map.get(String(cap2Id));
      return { key: String(cap2Id), label: c2 ? c2.ten : `Thương hiệu: ${cap2Id}` };
    }

    return { key: 'OTHER', label: 'Khác' };
  };

  // 5. TỔNG HỢP DỮ LIỆU BÁO CÁO (KỲ NÀY & CÙNG KỲ NĂM TRƯỚC)
  const reportData = useMemo(() => {
    // Aggregator maps: key -> { label, currentAmount, prevAmount }
    const aggMap = new Map<string, { key: string; label: string; currentAmount: number; prevAmount: number }>();

    const getOrCreate = (key: string, label: string) => {
      let item = aggMap.get(key);
      if (!item) {
        item = { key, label, currentAmount: 0, prevAmount: 0 };
        aggMap.set(key, item);
      }
      return item;
    };

    // DNTT Map để tra cứu thông tin phiếu
    const dnttMap = new Map(dnttList.map(d => [String(d.id), d]));

    // --- A. KỲ NÀY (selectedYear) ---
    currentPeriodMonths.forEach(m => {
      const isMonthClosed = closedMonthsCurrentPeriod.has(m);

      if (isMonthClosed) {
        // Tháng đã chốt: Lấy từ snapshot chi_phi_thong_ke
        const records = thongKeList.filter(tk => {
          const matchTime = Number(tk.nam) === selectedYear && Number(tk.thang) === m;
          const matchKmp = selectedKmpId === 'ALL' || String(tk.id_kmp) === String(selectedKmpId);
          const matchUnit = !allowedUnitIds || (tk.id_don_vi && allowedUnitIds.has(String(tk.id_don_vi)));
          return matchTime && matchKmp && matchUnit;
        });

        records.forEach(tk => {
          // Tra cứu cap1/cap2 nếu cần
          const bp = tk.id_bo_phan ? boPhanList.find(b => b.id === tk.id_bo_phan) : null;
          const cap1Id = bp?.ma_cap1;
          const cap2Id = bp?.ma_cap2;

          const { key, label } = getDimensionKeyAndLabel(
            tk.id_don_vi,
            tk.id_phap_nhan,
            tk.ma_so_thue,
            cap1Id,
            cap2Id
          );
          const item = getOrCreate(key, label);
          item.currentAmount += Number(tk.tong_tien || 0);
        });
      } else {
        // Tháng chưa chốt: Lấy từ dntt_phan_bo
        const activeAllocations = phanBoList.filter(pb => {
          if (Number(pb.nam) !== selectedYear || Number(pb.thang) !== m) return false;
          if (selectedKmpId !== 'ALL' && String(pb.id_kmp) !== String(selectedKmpId)) return false;
          const dntt = dnttMap.get(String(pb.dntt_id));
          if (!dntt) return false;
          const matchUnit = !allowedUnitIds || (dntt.id_don_vi && allowedUnitIds.has(String(dntt.id_don_vi)));
          if (!matchUnit) return false;
          const matchStatus = dnttStatusFilter === 'ALL'
            ? dntt.trang_thai !== 'Từ chối'
            : (dntt.trang_thai === 'Đã thanh toán' || dntt.trang_thai === 'Hoàn tất' || !dntt.trang_thai);
          return matchStatus;
        });

        activeAllocations.forEach(pb => {
          const dntt = dnttMap.get(String(pb.dntt_id));
          const { key, label } = getDimensionKeyAndLabel(
            dntt?.id_don_vi,
            dntt?.id_phap_nhan,
            undefined,
            pb.id_bo_phan_cap1,
            pb.id_bo_phan_cap2
          );
          const item = getOrCreate(key, label);
          item.currentAmount += Number(pb.so_tien || 0);
        });
      }
    });

    // --- B. CÙNG KỲ NĂM TRƯỚC (selectedYear - 1) ---
    const prevYear = selectedYear - 1;
    prevPeriodMonths.forEach(m => {
      const isMonthClosed = chotKyList.some(ck => Number(ck.nam) === prevYear && Number(ck.thang) === m && ck.trang_thai === 'da_chot');

      if (isMonthClosed) {
        const records = thongKeList.filter(tk => {
          const matchTime = Number(tk.nam) === prevYear && Number(tk.thang) === m;
          const matchKmp = selectedKmpId === 'ALL' || String(tk.id_kmp) === String(selectedKmpId);
          const matchUnit = !allowedUnitIds || (tk.id_don_vi && allowedUnitIds.has(String(tk.id_don_vi)));
          return matchTime && matchKmp && matchUnit;
        });

        records.forEach(tk => {
          const bp = tk.id_bo_phan ? boPhanList.find(b => b.id === tk.id_bo_phan) : null;
          const cap1Id = bp?.ma_cap1;
          const cap2Id = bp?.ma_cap2;

          const { key, label } = getDimensionKeyAndLabel(
            tk.id_don_vi,
            tk.id_phap_nhan,
            tk.ma_so_thue,
            cap1Id,
            cap2Id
          );
          const item = getOrCreate(key, label);
          item.prevAmount += Number(tk.tong_tien || 0);
        });
      } else {
        const activeAllocations = phanBoList.filter(pb => {
          if (Number(pb.nam) !== prevYear || Number(pb.thang) !== m) return false;
          if (selectedKmpId !== 'ALL' && String(pb.id_kmp) !== String(selectedKmpId)) return false;
          const dntt = dnttMap.get(String(pb.dntt_id));
          if (!dntt) return false;
          const matchUnit = !allowedUnitIds || (dntt.id_don_vi && allowedUnitIds.has(String(dntt.id_don_vi)));
          if (!matchUnit) return false;
          const matchStatus = dnttStatusFilter === 'ALL'
            ? dntt.trang_thai !== 'Từ chối'
            : (dntt.trang_thai === 'Đã thanh toán' || dntt.trang_thai === 'Hoàn tất' || !dntt.trang_thai);
          return matchStatus;
        });

        activeAllocations.forEach(pb => {
          const dntt = dnttMap.get(String(pb.dntt_id));
          const { key, label } = getDimensionKeyAndLabel(
            dntt?.id_don_vi,
            dntt?.id_phap_nhan,
            undefined,
            pb.id_bo_phan_cap1,
            pb.id_bo_phan_cap2
          );
          const item = getOrCreate(key, label);
          item.prevAmount += Number(pb.so_tien || 0);
        });
      }
    });

    // Chuyển map thành mảng và tính toán chênh lệch, sắp xếp giảm dần theo số tiền kỳ này
    const rows = Array.from(aggMap.values())
      .filter(r => r.currentAmount > 0 || r.prevAmount > 0)
      .map(r => {
        const diff = r.currentAmount - r.prevAmount;
        let percent = 0;
        if (r.prevAmount > 0) {
          percent = (diff / r.prevAmount) * 100;
        } else if (r.currentAmount > 0) {
          percent = 100;
        }
        return {
          ...r,
          diff,
          percent
        };
      })
      .sort((a, b) => b.currentAmount - a.currentAmount);

    const totalCurrent = rows.reduce((s, r) => s + r.currentAmount, 0);
    const totalPrev = rows.reduce((s, r) => s + r.prevAmount, 0);
    const totalDiff = totalCurrent - totalPrev;
    const totalPercent = totalPrev > 0 ? (totalDiff / totalPrev) * 100 : (totalCurrent > 0 ? 100 : 0);

    return {
      rows,
      totalCurrent,
      totalPrev,
      totalDiff,
      totalPercent
    };
  }, [
    currentPeriodMonths,
    prevPeriodMonths,
    selectedYear,
    selectedKmpId,
    closedMonthsCurrentPeriod,
    thongKeList,
    phanBoList,
    dnttList,
    dimension,
    donViMap,
    phapNhanMap,
    mstRepresentativeMap,
    boPhanList,
    cap1Map,
    cap2Map,
    chotKyList,
    dnttStatusFilter,
    allowedUnitIds
  ]);

  // 6. XỬ LÝ CHỐT KỲ MỚI
  const handleCreateChotKy = async () => {
    if (!newChotThang || !newChotNam) {
      toast.warning('Vui lòng chọn đầy đủ Tháng và Năm cần chốt kỳ!');
      return;
    }

    setChotKySubmitting(true);
    try {
      const res = await apiService.chotKyChiPhi(
        newChotThang,
        newChotNam,
        user?.ho_ten || user?.email || 'Quản trị viên',
        newChotGhiChu
      );
      toast.success(`Chốt kỳ Tháng ${newChotThang}/${newChotNam} thành công! Đã snapshot ${res.so_dong_snapshot} dòng thống kê.`);
      setNewChotGhiChu('');
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Có lỗi xảy ra khi chốt kỳ!');
    } finally {
      setChotKySubmitting(false);
    }
  };

  // 7. XỬ LÝ HỦY CHỐT KỲ
  const handleRevokeChotKy = async (chotKyId: string) => {
    setChotKySubmitting(true);
    try {
      await apiService.huyChotKyChiPhi(chotKyId, user?.ho_ten || user?.email || 'Quản trị viên');
      toast.success('Đã hủy chốt kỳ thành công! Dữ liệu DNTT trong kỳ đã được mở khóa.');
      setRevokeConfirmId(null);
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Có lỗi xảy ra khi hủy chốt kỳ!');
    } finally {
      setChotKySubmitting(false);
    }
  };

  // 8. XUẤT BÁO CÁO EXCEL CHUẨN ĐỊNH DẠNG XML SPREADSHEET (MỞ TRỰC TIẾP TRÊN EXCEL)
  const handleExportExcel = () => {
    if (reportData.rows.length === 0) {
      toast.warning('Không có dữ liệu báo cáo để xuất file!');
      return;
    }

    const dimensionTitleMap: Record<DimensionType, string> = {
      don_vi_phan_loai: 'Phân loại Đơn vị (VPĐH / CTTT)',
      mien: 'Miền (Bắc / Nam)',
      don_vi_quan_tri: 'Đơn vị Quản trị (Công ty Tỉnh thành)',
      phap_nhan_mst: 'Pháp nhân theo Mã số thuế',
      showroom: 'Showroom / Cơ sở trực thuộc',
      khoi_nghiep_vu: 'Khối / Nghiệp vụ (Cấp 1)',
      bo_phan_thuong_hieu: 'Bộ phận / Thương hiệu (Cấp 2)'
    };

    const dimTitle = dimensionTitleMap[dimension];
    const kmpName = selectedKmpId === 'ALL'
      ? 'Tất cả Khoản mục phí'
      : (() => {
          const k = kmpMap.get(selectedKmpId);
          if (!k) return selectedKmpId;
          const code = (k.ma_b7 || k.ma_b10 || '').trim();
          const name = (k.dien_giai || k.nhom_chi_phi || '').trim();
          return code ? `${code} - ${name}` : name;
        })();

    const escapeXML = (str: any) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const rowsXML = reportData.rows.map((r, idx) => `
      <Row>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
        <Cell ss:StyleID="sText"><Data ss:Type="String">${escapeXML(r.label)}</Data></Cell>
        <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${r.currentAmount}</Data></Cell>
        <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${r.prevAmount}</Data></Cell>
        <Cell ss:StyleID="${r.diff >= 0 ? 'sNumberDiffPos' : 'sNumberDiffNeg'}"><Data ss:Type="Number">${r.diff}</Data></Cell>
        <Cell ss:StyleID="sPercent"><Data ss:Type="Number">${(r.percent / 100).toFixed(4)}</Data></Cell>
      </Row>
    `).join('');

    const totalRowXML = `
      <Row ss:Height="24">
        <Cell ss:StyleID="sTotalCenter"><Data ss:Type="String">TỔNG</Data></Cell>
        <Cell ss:StyleID="sTotalText"><Data ss:Type="String">TỔNG CỘNG TOÀN BỘ</Data></Cell>
        <Cell ss:StyleID="sTotalNumber"><Data ss:Type="Number">${reportData.totalCurrent}</Data></Cell>
        <Cell ss:StyleID="sTotalNumber"><Data ss:Type="Number">${reportData.totalPrev}</Data></Cell>
        <Cell ss:StyleID="sTotalNumber"><Data ss:Type="Number">${reportData.totalDiff}</Data></Cell>
        <Cell ss:StyleID="sTotalPercent"><Data ss:Type="Number">${(reportData.totalPercent / 100).toFixed(4)}</Data></Cell>
      </Row>
    `;

    const excelTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="sTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="15" ss:Bold="1" ss:Color="#D97706"/>
  </Style>
  <Style ss:ID="sSubTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#4B5563"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#D97706" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
   </Borders>
  </Style>
  <Style ss:ID="sText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sNumberDiffPos">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:Color="#B45309" ss:Bold="1"/>
   <NumberFormat ss:Format="+#,##0;-#,##0;0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sNumberDiffNeg">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:Color="#059669" ss:Bold="1"/>
   <NumberFormat ss:Format="+#,##0;-#,##0;0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sPercent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="0.0%"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="sTotalCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
   </Borders>
  </Style>
  <Style ss:ID="sTotalText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
   </Borders>
  </Style>
  <Style ss:ID="sTotalNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <NumberFormat ss:Format="#,##0"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
   </Borders>
  </Style>
  <Style ss:ID="sTotalPercent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <NumberFormat ss:Format="0.0%"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="ThongKeChiPhi">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="40"/>
   <Column ss:Width="260"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="120"/>
   <Column ss:Width="90"/>
   <Row ss:Height="30">
    <Cell ss:MergeAcross="5" ss:StyleID="sTitle"><Data ss:Type="String">BÁO CÁO THỐNG KÊ VÀ ĐỐI SÁNH CHI PHÍ</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="5" ss:StyleID="sSubTitle"><Data ss:Type="String">Kỳ báo cáo: ${escapeXML(periodLabel)} | So sánh với: ${escapeXML(prevPeriodLabel)} | Tiêu chí: ${escapeXML(dimTitle)} | KMP: ${escapeXML(kmpName)}</Data></Cell>
   </Row>
   <Row ss:Index="4" ss:Height="26">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">TT</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXML(dimTitle)}</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Kỳ này (VNĐ)</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Cùng kỳ năm trước (VNĐ)</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Chênh lệch (VNĐ)</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">% Tăng/Giảm</Data></Cell>
   </Row>
   ${rowsXML}
   ${totalRowXML}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_Cao_Thong_Ke_Chi_Phi_${periodLabel.replace(/[\/\s]/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã tải file Excel Báo cáo Thống kê thành công!');
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. TOP STATS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Kỳ này */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 font-medium">Chi phí {periodLabel}</div>
            <div className="text-lg font-bold font-mono text-[#D97706] mt-1">
              {reportData.totalCurrent.toLocaleString('vi-VN')} <span className="text-xs font-sans text-gray-400">VNĐ</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-[#D97706] flex items-center justify-center">
            <BarChart2 size={20} />
          </div>
        </div>

        {/* Card 2: Cùng kỳ */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 font-medium">Cùng kỳ ({prevPeriodLabel})</div>
            <div className="text-lg font-bold font-mono text-gray-700 dark:text-gray-200 mt-1">
              {reportData.totalPrev.toLocaleString('vi-VN')} <span className="text-xs font-sans text-gray-400">VNĐ</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 flex items-center justify-center">
            <Calendar size={20} />
          </div>
        </div>

        {/* Card 3: Chênh lệch */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 font-medium">Chênh lệch cùng kỳ</div>
            <div className={`text-lg font-bold font-mono mt-1 flex items-center gap-1.5 ${
              reportData.totalDiff > 0 ? 'text-amber-600' : (reportData.totalDiff < 0 ? 'text-emerald-600' : 'text-gray-600')
            }`}>
              <span>{reportData.totalDiff > 0 ? `+${reportData.totalDiff.toLocaleString('vi-VN')}` : reportData.totalDiff.toLocaleString('vi-VN')}</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700">
                {reportData.totalPercent > 0 ? `+${reportData.totalPercent.toFixed(1)}%` : `${reportData.totalPercent.toFixed(1)}%`}
              </span>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            reportData.totalDiff > 0
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600'
              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600'
          }`}>
            {reportData.totalDiff >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
        </div>

        {/* Card 4: Tình trạng chốt kỳ */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 font-medium">Trạng thái kỳ này</div>
            <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
              {closedMonthsCurrentPeriod.size === currentPeriodMonths.length ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 size={16} /> Đã chốt số liệu ({closedMonthsCurrentPeriod.size}/{currentPeriodMonths.length} tháng)
                </span>
              ) : closedMonthsCurrentPeriod.size > 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                  <Lock size={16} /> Chốt 1 phần ({closedMonthsCurrentPeriod.size}/{currentPeriodMonths.length} tháng)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                  <Unlock size={16} /> Chưa chốt (Dữ liệu live)
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setChotKyModalOpen(true)}
            className="px-2.5 py-1.5 bg-[#D97706] hover:bg-[#b45309] text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
          >
            <Lock size={14} />
            <span>Quản lý</span>
          </button>
        </div>
      </div>

      {/* 2. THANH CÔNG CỤ BỘ LỌC ĐA CHIỀU */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200/80 dark:border-slate-700/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Lọc chiều phân tích (Single Dimension) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
              <Layers size={15} className="text-[#D97706]" />
              <span>Chiều phân tích:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'don_vi_phan_loai', label: 'VPĐH / CTTT' },
                { id: 'mien', label: 'Miền (Bắc / Nam)' },
                { id: 'don_vi_quan_tri', label: 'Đơn vị Quản trị' },
                { id: 'phap_nhan_mst', label: 'Pháp nhân (theo MST)' },
                { id: 'showroom', label: 'Showroom' },
                { id: 'khoi_nghiep_vu', label: 'Khối (Cấp 1)' },
                { id: 'bo_phan_thuong_hieu', label: 'Thương hiệu (Cấp 2)' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDimension(opt.id as DimensionType)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    dimension === opt.id
                      ? 'bg-[#D97706] text-white shadow-xs font-bold'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nút Xuất Excel & Refresh */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <FileSpreadsheet size={15} />
              <span>Xuất Excel</span>
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-[#D97706]' : ''} />
            </button>
          </div>
        </div>

        {/* Hàng bộ lọc thời gian & KMP */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-slate-700 text-xs">
          {/* Kiểu kỳ: Tháng / Quý / 6 Tháng / Năm */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 p-0.5 rounded-lg">
            {(['thang', 'quy', '6thang', 'nam'] as PeriodType[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodType(p)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  periodType === p
                    ? 'bg-white dark:bg-slate-800 text-[#D97706] font-bold shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                }`}
              >
                {p === 'thang' ? 'Tháng' : p === 'quy' ? 'Quý' : p === '6thang' ? '6 Tháng' : 'Cả Năm'}
              </button>
            ))}
          </div>

          {/* Chọn tháng cụ thể */}
          {periodType === 'thang' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#D97706]"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          )}

          {/* Chọn quý cụ thể */}
          {periodType === 'quy' && (
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(Number(e.target.value))}
              className="bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#D97706]"
            >
              <option value={1}>Quý 1 (Tháng 1 - 3)</option>
              <option value={2}>Quý 2 (Tháng 4 - 6)</option>
              <option value={3}>Quý 3 (Tháng 7 - 9)</option>
              <option value={4}>Quý 4 (Tháng 10 - 12)</option>
            </select>
          )}

          {/* Chọn 6 tháng cụ thể */}
          {periodType === '6thang' && (
            <select
              value={selectedHalf}
              onChange={(e) => setSelectedHalf(Number(e.target.value) as 1 | 2)}
              className="bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#D97706]"
            >
              <option value={1}>6 tháng đầu năm (T1 - T6)</option>
              <option value={2}>6 tháng cuối năm (T7 - T12)</option>
            </select>
          )}

          {/* Chọn Năm */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1 font-semibold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#D97706]"
          >
            {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2, now.getFullYear() - 3].map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>

          {/* Lọc trạng thái phiếu DNTT (khi chưa chốt kỳ) */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">Trạng thái:</span>
            <select
              value={dnttStatusFilter}
              onChange={(e) => setDnttStatusFilter(e.target.value as 'ALL' | 'PAID')}
              className="bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-gray-800 dark:text-gray-100 font-semibold focus:outline-none focus:ring-1 focus:ring-[#D97706]"
              title="Lọc trạng thái phiếu ĐNTT khi xem dữ liệu chưa chốt kỳ"
            >
              <option value="ALL">Tất cả phiếu DNTT</option>
              <option value="PAID">Chỉ phiếu Đã thanh toán</option>
            </select>
          </div>

          {/* Chọn Khoản mục phí (KMP) */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-gray-500 font-medium">Khoản mục phí:</span>
            <select
              value={selectedKmpId}
              onChange={(e) => setSelectedKmpId(e.target.value)}
              className="bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-gray-800 dark:text-gray-100 max-w-[280px] focus:outline-none focus:ring-1 focus:ring-[#D97706] text-xs font-medium"
            >
              <option value="ALL">-- Tất cả Khoản mục phí ({kmpList.length}) --</option>
              {groupedKmp.map(([group, items]) => (
                <optgroup key={group} label={`📁 ${group}`}>
                  {items.map(k => {
                    const code = k.ma_b7 || k.ma_b10;
                    const name = k.dien_giai || k.nhom_chi_phi || 'Khoản mục';
                    const star = k.trong_yeu ? ' ⭐' : '';
                    return (
                      <option key={k.id} value={k.id}>
                        {code ? `${code} - ${name}${star}` : `${name}${star}`}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. BẢNG PIVOT ĐỐI SÁNH CÙNG KỲ */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-gray-200/80 dark:border-slate-700/80 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-700/80 text-gray-600 dark:text-gray-200 font-semibold border-b border-gray-200 dark:border-slate-600">
              <tr>
                <th className="p-3 w-12 text-center">TT</th>
                <th className="p-3 min-w-[240px]">
                  {dimension === 'don_vi_phan_loai' && 'Phân loại Đơn vị'}
                  {dimension === 'mien' && 'Miền'}
                  {dimension === 'don_vi_quan_tri' && 'Đơn vị Quản trị (Công ty Tỉnh thành)'}
                  {dimension === 'phap_nhan_mst' && 'Pháp nhân theo Mã số thuế'}
                  {dimension === 'showroom' && 'Showroom / Cơ sở'}
                  {dimension === 'khoi_nghiep_vu' && 'Khối / Nghiệp vụ (Cấp 1)'}
                  {dimension === 'bo_phan_thuong_hieu' && 'Bộ phận / Thương hiệu (Cấp 2)'}
                </th>
                <th className="p-3 w-44 text-right">Kỳ này ({periodLabel})</th>
                <th className="p-3 w-44 text-right">Cùng kỳ ({prevPeriodLabel})</th>
                <th className="p-3 w-40 text-right">Chênh lệch (VNĐ)</th>
                <th className="p-3 w-28 text-right">% Tăng/Giảm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-gray-700 dark:text-gray-300">
              {reportData.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    <BarChart2 size={36} className="mx-auto mb-2 opacity-50 text-[#D97706]" />
                    <p className="font-semibold text-gray-600 dark:text-gray-300">Chưa có số liệu chi phí cho kỳ và bộ lọc đã chọn.</p>
                    <p className="text-xs text-gray-400 mt-1">Hãy thử chọn kỳ khác hoặc kiểm tra lại các phiếu ĐNTT đã thanh toán.</p>
                  </td>
                </tr>
              ) : (
                reportData.rows.map((r, idx) => (
                  <tr key={r.key} className="hover:bg-amber-50/30 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="p-3 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                    <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">{r.label}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#D97706]">
                      {r.currentAmount.toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400">
                      {r.prevAmount.toLocaleString('vi-VN')}
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${
                      r.diff > 0 ? 'text-amber-600' : (r.diff < 0 ? 'text-emerald-600' : 'text-gray-400')
                    }`}>
                      {r.diff > 0 ? `+${r.diff.toLocaleString('vi-VN')}` : r.diff.toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-md text-xs font-semibold ${
                        r.diff > 0
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                          : r.diff < 0
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {r.percent > 0 ? `+${r.percent.toFixed(1)}%` : `${r.percent.toFixed(1)}%`}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Dòng TỔNG CỘNG */}
            {reportData.rows.length > 0 && (
              <tfoot className="sticky bottom-0 z-10 bg-amber-50/90 dark:bg-slate-700 text-gray-900 dark:text-gray-100 font-bold border-t-2 border-amber-300 dark:border-amber-600">
                <tr>
                  <td className="p-3 text-center text-xs">TỔNG</td>
                  <td className="p-3 uppercase text-xs tracking-wide text-[#D97706]">
                    TỔNG CỘNG ({reportData.rows.length} chỉ tiêu)
                  </td>
                  <td className="p-3 text-right font-mono text-base text-[#D97706]">
                    {reportData.totalCurrent.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-gray-700 dark:text-gray-300">
                    {reportData.totalPrev.toLocaleString('vi-VN')}
                  </td>
                  <td className={`p-3 text-right font-mono text-sm ${
                    reportData.totalDiff > 0 ? 'text-amber-700' : (reportData.totalDiff < 0 ? 'text-emerald-700' : 'text-gray-700')
                  }`}>
                    {reportData.totalDiff > 0 ? `+${reportData.totalDiff.toLocaleString('vi-VN')}` : reportData.totalDiff.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-3 text-right font-mono text-sm">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ${
                      reportData.totalDiff > 0
                        ? 'bg-amber-200/70 text-amber-900'
                        : reportData.totalDiff < 0
                        ? 'bg-emerald-200/70 text-emerald-900'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {reportData.totalPercent > 0 ? `+${reportData.totalPercent.toFixed(1)}%` : `${reportData.totalPercent.toFixed(1)}%`}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 4. MODAL QUẢN LÝ CHỐT KỲ */}
      {chotKyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-[#D97706] flex items-center justify-center">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Quản lý Chốt kỳ Chi phí</h3>
                  <p className="text-xs text-gray-500">Đóng băng số liệu báo cáo & Khóa an toàn các phiếu ĐNTT trong kỳ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChotKyModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 custom-scrollbar pr-1">
              {/* Form Chốt kỳ mới */}
              <div className="p-4 bg-amber-50/60 dark:bg-slate-700/50 rounded-xl border border-amber-200 dark:border-slate-600 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#D97706] flex items-center gap-1.5">
                  <ShieldAlert size={15} />
                  <span>Chốt số liệu kỳ kế toán mới</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Tháng</label>
                    <select
                      value={newChotThang}
                      onChange={(e) => setNewChotThang(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-2 text-xs font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>Tháng {m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Năm</label>
                    <select
                      value={newChotNam}
                      onChange={(e) => setNewChotNam(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-2 text-xs font-semibold text-gray-900 dark:text-gray-100"
                    >
                      {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
                        <option key={y} value={y}>Năm {y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">Ghi chú kỳ chốt</label>
                    <input
                      type="text"
                      value={newChotGhiChu}
                      onChange={(e) => setNewChotGhiChu(e.target.value)}
                      placeholder="VD: Chốt sau kiểm toán T8"
                      className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleCreateChotKy}
                    disabled={chotKySubmitting}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#D97706] hover:bg-[#b45309] text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Lock size={14} />
                    <span>{chotKySubmitting ? 'Đang thực hiện snapshot...' : 'Chốt số liệu kỳ này'}</span>
                  </button>
                </div>
              </div>

              {/* Danh sách các kỳ đã chốt */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between">
                  <span>Lịch sử các kỳ đã chốt ({chotKyList.filter(c => c.trang_thai === 'da_chot').length} kỳ đang hiệu lực)</span>
                </h4>

                <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-slate-600">
                      <tr>
                        <th className="p-2.5">Kỳ (Tháng/Năm)</th>
                        <th className="p-2.5">Trạng thái</th>
                        <th className="p-2.5">Người chốt</th>
                        <th className="p-2.5">Thời gian</th>
                        <th className="p-2.5">Ghi chú</th>
                        <th className="p-2.5 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {chotKyList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-gray-400 text-xs">
                            Chưa có kỳ nào được chốt trong hệ thống.
                          </td>
                        </tr>
                      ) : (
                        chotKyList.map(ck => (
                          <tr key={ck.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30">
                            <td className="p-2.5 font-bold text-[#D97706] font-mono">
                              Tháng {ck.thang}/{ck.nam}
                            </td>
                            <td className="p-2.5">
                              {ck.trang_thai === 'da_chot' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Lock size={10} /> Đang chốt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                                  <Unlock size={10} /> Đã hủy chốt
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 font-medium text-gray-800 dark:text-gray-200">{ck.chot_boi || '-'}</td>
                            <td className="p-2.5 font-mono text-gray-500 text-[11px]">
                              {ck.chot_luc ? new Date(ck.chot_luc).toLocaleString('vi-VN') : '-'}
                            </td>
                            <td className="p-2.5 text-gray-600 dark:text-gray-400 max-w-[140px] truncate" title={ck.ghi_chu}>
                              {ck.ghi_chu || '-'}
                            </td>
                            <td className="p-2.5 text-center">
                              {ck.trang_thai === 'da_chot' && (
                                revokeConfirmId === ck.id ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeChotKy(ck.id)}
                                      disabled={chotKySubmitting}
                                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                    >
                                      Xác nhận
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRevokeConfirmId(null)}
                                      className="px-1.5 py-1 text-gray-500 hover:bg-gray-100 rounded text-[10px] cursor-pointer"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setRevokeConfirmId(ck.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer text-xs font-semibold"
                                    title="Hủy chốt kỳ này"
                                  >
                                    Hủy chốt
                                  </button>
                                )
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex justify-end pt-3 border-t border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setChotKyModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
