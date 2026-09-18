import { 
  ChiPhiThongKe, ChiPhiChotKy, DNTT, DnttPhanBo, DmKmp, 
  DonVi, DmNhomChiPhi, DmBoPhan, BoPhanCap1, BoPhanCap2
} from '../types';
import { getAllSubordinateIds, isCostManagementUnit, resolveCostManagementUnit } from './hierarchy';

export interface MonthValue {
  amount: number;
  isTemporary: boolean;
}

export interface MatrixRowItem {
  id: string;
  stt: string;
  name: string;
  code?: string;
  level: 'group' | 'kmp' | 'child';
  groupId?: string;
  kmpId?: string;
  allocationPercent?: number | null; // Tỷ lệ % tính động = (child / parent_kmp) * 100
  months: Record<number, MonthValue>;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  yearTotal: number;
  priorYearTotal: number;
  variance: number;
  percentChange: number | null; // null nếu năm trước không có dữ liệu -> hiển thị "—"
  hasTemporaryData: boolean;
  children?: MatrixRowItem[];
}

export interface MatrixSummary {
  months: Record<number, MonthValue>;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  yearTotal: number;
  priorYearTotal: number;
  variance: number;
  percentChange: number | null;
  hasTemporaryData: boolean;
}

export interface MatrixDataResult {
  year: number;
  rows: MatrixRowItem[];
  summary: MatrixSummary;
  closedMonths: Set<number>;
  unclosedMonths: Set<number>;
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/**
 * Tính toán ma trận chi phí chuẩn THACO AUTO
 */
export function buildThacoCostMatrix({
  year,
  thongKeList,
  chotKyList,
  dnttList,
  phanBoList,
  kmpList,
  nhomChiPhiList = [],
  donViList,
  fullDonViList,
  boPhanList = [],
  selectedUnitFilter,
  userPermittedUnitIds,
  includeTemporary = false,
  onlyAdministrative = true
}: {
  year: number;
  thongKeList: ChiPhiThongKe[];
  chotKyList: ChiPhiChotKy[];
  dnttList: DNTT[];
  phanBoList: DnttPhanBo[];
  kmpList: DmKmp[];
  nhomChiPhiList?: DmNhomChiPhi[];
  donViList: DonVi[];
  fullDonViList?: DonVi[];
  boPhanList?: DmBoPhan[];
  selectedUnitFilter?: string | null;
  userPermittedUnitIds?: Set<string> | null;
  includeTemporary?: boolean;
  onlyAdministrative?: boolean;
}): MatrixDataResult {
  // 1. Xác định các tháng đã chốt & chưa chốt
  const closedMonths = new Set<number>();
  const unclosedMonths = new Set<number>();
  for (let m = 1; m <= 12; m++) {
    const isClosed = chotKyList.some(ck => Number(ck.nam) === year && Number(ck.thang) === m && ck.trang_thai === 'da_chot');
    if (isClosed) {
      closedMonths.add(m);
    } else {
      unclosedMonths.add(m);
    }
  }

  // 2. Bộ lọc đơn vị được chọn & cấp con
  const allowedUnitIds = (!selectedUnitFilter || selectedUnitFilter === 'ALL')
    ? (userPermittedUnitIds || null)
    : new Set([String(selectedUnitFilter), ...getAllSubordinateIds(selectedUnitFilter, donViList)]);

  // 3. Mapping KMP & Đơn vị (Chỉ giữ các Đơn vị Quản trị: Văn phòng, CTTT, Showroom Quản trị)
  const mgmtDonViList = donViList.filter(isCostManagementUnit);
  const donViMap = new Map<string, DonVi>(mgmtDonViList.map(d => [String(d.id), d]));
  const kmpMap = new Map<string, DmKmp>(kmpList.map(k => [String(k.id), k]));
  const dnttMap = new Map<string, DNTT>(dnttList.map(d => [String(d.id), d]));

  // Helper quy đổi đơn vị về Đơn vị Quản trị nếu id_don_vi là Showroom con / Đại lý con
  const resolveUnit = (rawUnitId?: string | null): string => {
    if (!rawUnitId) return '';
    const sId = String(rawUnitId);
    if (donViMap.has(sId)) return sId;
    if (fullDonViList && fullDonViList.length > 0) {
      const parentMgmt = resolveCostManagementUnit(sId, fullDonViList);
      if (parentMgmt) return String(parentMgmt.id);
    }
    return sId;
  };

  // Lọc KMP hợp lệ theo cờ Chi phí hành chính nếu được yêu cầu
  const validKmpList = kmpList.filter(k => {
    if (onlyAdministrative && k.thuoc_bao_cao_hanh_chinh === false) return false;
    return true;
  });

  // Gom nhóm KMP theo nhóm chi phí
  // Danh sách nhóm chi phí
  const groupOrderMap = new Map<string, number>();
  nhomChiPhiList.forEach(g => {
    groupOrderMap.set(g.ten_nhom.trim(), g.thu_tu || 99);
  });

  const kmpByGroup = new Map<string, DmKmp[]>();
  validKmpList.forEach(k => {
    const grpName = (k.nhom_chi_phi || 'Chi phí khác').trim();
    if (!kmpByGroup.has(grpName)) {
      kmpByGroup.set(grpName, []);
    }
    kmpByGroup.get(grpName)!.push(k);
  });

  // Sắp xếp các nhóm
  const sortedGroupNames = Array.from(kmpByGroup.keys()).sort((a, b) => {
    const ordA = groupOrderMap.get(a) ?? 99;
    const ordB = groupOrderMap.get(b) ?? 99;
    if (ordA !== ordB) return ordA - ordB;
    return a.localeCompare(b, 'vi');
  });

  // 4. Data Accumulators:
  // kmpAmounts: Map<kmpId, { months: Record<number, MonthValue>, priorYearMonths: Record<number, number> }>
  // childAmounts: Map<`${kmpId}_${childUnitId}`, { unitName, months: Record<number, MonthValue>, priorYearMonths: Record<number, number> }>
  interface AmountBucket {
    months: Record<number, MonthValue>;
    priorYearMonths: Record<number, number>;
  }

  const createBucket = (): AmountBucket => {
    const months: Record<number, MonthValue> = {};
    const priorYearMonths: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      months[m] = { amount: 0, isTemporary: false };
      priorYearMonths[m] = 0;
    }
    return { months, priorYearMonths };
  };

  const kmpBuckets = new Map<string, AmountBucket>();
  const childBuckets = new Map<string, { unitId: string; unitName: string; bucket: AmountBucket }>();

  const getKmpBucket = (kmpId: string) => {
    let b = kmpBuckets.get(kmpId);
    if (!b) {
      b = createBucket();
      kmpBuckets.set(kmpId, b);
    }
    return b;
  };

  const getChildBucket = (kmpId: string, unitId: string) => {
    const key = `${kmpId}_${unitId}`;
    let c = childBuckets.get(key);
    if (!c) {
      const u = donViMap.get(unitId) || (fullDonViList ? fullDonViList.find(d => String(d.id) === String(unitId)) : undefined) || donViList.find(d => String(d.id) === String(unitId));
      const unitName = u?.ten_don_vi || `Đơn vị ${unitId}`;
      c = { unitId, unitName, bucket: createBucket() };
      childBuckets.set(key, c);
    }
    return c;
  };

  // --- NẠP DỮ LIỆU TRỰC TIẾP TỪ dntt_phan_bo (Tất cả các phiếu DNTT đã lưu) ---
  phanBoList.forEach(pb => {
    const kmp = kmpMap.get(String(pb.id_kmp));
    if (!kmp) return;
    if (onlyAdministrative && kmp.thuoc_bao_cao_hanh_chinh === false) return;

    const dntt = dnttMap.get(String(pb.dntt_id));
    if (!dntt) return;
    if (dntt.trang_thai === 'Từ chối' || dntt.trang_thai === 'Lưu nháp') return;

    const rawUnitId = dntt.id_don_vi ? String(dntt.id_don_vi) : '';
    const unitId = resolveUnit(rawUnitId);
    if (allowedUnitIds && unitId && !allowedUnitIds.has(unitId) && (!rawUnitId || !allowedUnitIds.has(rawUnitId))) {
      return;
    }

    const m = Number(pb.thang);
    const y = Number(pb.nam);
    const amount = Number(pb.so_tien) || 0;
    if (m < 1 || m > 12) return;

    // Khi xem một đơn vị quản trị cụ thể: hiển thị dòng con theo đúng Showroom phát sinh
    // Khi xem Toàn công ty (ALL): gom nhóm dòng con theo Công ty Tỉnh thành quản trị
    const isSpecificUnit = Boolean(selectedUnitFilter && selectedUnitFilter !== 'ALL');
    const childUnitId = isSpecificUnit ? (rawUnitId || unitId) : (unitId || rawUnitId);

    if (y === year) {
      const kb = getKmpBucket(kmp.id);
      kb.months[m].amount += amount;
      kb.months[m].isTemporary = false;

      if (childUnitId) {
        const cb = getChildBucket(kmp.id, childUnitId);
        cb.bucket.months[m].amount += amount;
        cb.bucket.months[m].isTemporary = false;
      }
    } else if (y === year - 1) {
      const kb = getKmpBucket(kmp.id);
      kb.priorYearMonths[m] += amount;

      if (childUnitId) {
        const cb = getChildBucket(kmp.id, childUnitId);
        cb.bucket.priorYearMonths[m] += amount;
      }
    }
  });

  // Fallback: nếu năm trước (year - 1) chưa có trong dntt_phan_bo nhưng có trong chi_phi_thong_ke cũ
  thongKeList.forEach(tk => {
    const kmp = kmpMap.get(String(tk.id_kmp));
    if (!kmp) return;
    if (onlyAdministrative && (tk.thuoc_bao_cao_hanh_chinh === false || kmp.thuoc_bao_cao_hanh_chinh === false)) return;

    const rawUnitId = tk.id_don_vi ? String(tk.id_don_vi) : '';
    const unitId = resolveUnit(rawUnitId);
    if (allowedUnitIds && unitId && !allowedUnitIds.has(unitId) && (!rawUnitId || !allowedUnitIds.has(rawUnitId))) return;

    const m = Number(tk.thang);
    const y = Number(tk.nam);
    const amount = Number(tk.tong_tien) || 0;
    if (m < 1 || m > 12) return;

    const isSpecificUnit = Boolean(selectedUnitFilter && selectedUnitFilter !== 'ALL');
    const childUnitId = isSpecificUnit ? (rawUnitId || unitId) : (unitId || rawUnitId);

    if (y === year - 1) {
      const kb = getKmpBucket(kmp.id);
      if (kb.priorYearMonths[m] === 0) {
        kb.priorYearMonths[m] += amount;
        if (childUnitId) {
          const cb = getChildBucket(kmp.id, childUnitId);
          cb.bucket.priorYearMonths[m] += amount;
        }
      }
    }
  });

  // Helper tính các cột tổng hợp từ months & priorYearMonths
  const computeRowTotals = (
    months: Record<number, MonthValue>,
    priorYearMonths: Record<number, number>
  ) => {
    const q1 = months[1].amount + months[2].amount + months[3].amount;
    const q2 = months[4].amount + months[5].amount + months[6].amount;
    const q3 = months[7].amount + months[8].amount + months[9].amount;
    const q4 = months[10].amount + months[11].amount + months[12].amount;
    const yearTotal = q1 + q2 + q3 + q4;

    const priorYearTotal = Object.values(priorYearMonths).reduce((s, a) => s + a, 0);
    const variance = yearTotal - priorYearTotal;
    const percentChange = priorYearTotal > 0 ? (variance / priorYearTotal) * 100 : null;

    const hasTemporaryData = false;

    return { q1, q2, q3, q4, yearTotal, priorYearTotal, variance, percentChange, hasTemporaryData };
  };

  // 5. Xây dựng cây ma trận: Nhóm La Mã -> KMP -> Child Units
  const matrixRows: MatrixRowItem[] = [];

  sortedGroupNames.forEach((grpName, grpIdx) => {
    const kmpsInGroup = kmpByGroup.get(grpName) || [];
    const romanStt = ROMAN_NUMERALS[grpIdx] || `${grpIdx + 1}`;
    const groupId = `GRP_${grpIdx + 1}`;

    const groupMonths: Record<number, MonthValue> = {};
    const groupPriorMonths: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      groupMonths[m] = { amount: 0, isTemporary: false };
      groupPriorMonths[m] = 0;
    }

    const kmpRowItems: MatrixRowItem[] = [];

    kmpsInGroup.forEach((kmp, kmpIdx) => {
      const kb = getKmpBucket(kmp.id);
      const kmpTotals = computeRowTotals(kb.months, kb.priorYearMonths);

      // Tích lũy vào nhóm
      for (let m = 1; m <= 12; m++) {
        groupMonths[m].amount += kb.months[m].amount;
        if (kb.months[m].isTemporary && kb.months[m].amount > 0) {
          groupMonths[m].isTemporary = true;
        }
        groupPriorMonths[m] += kb.priorYearMonths[m];
      }

      // Xây dựng dòng con (Child rows theo Showroom / Đơn vị) cho riêng KMP này
      const childRows: MatrixRowItem[] = [];
      const kmpPrefix = `${kmp.id}_`;
      childBuckets.forEach((c, key) => {
        if (!key.startsWith(kmpPrefix)) return;
        const cTotals = computeRowTotals(c.bucket.months, c.bucket.priorYearMonths);
        if (cTotals.yearTotal > 0 || cTotals.priorYearTotal > 0) {
          // Tỷ lệ % tính động = (child / kmp_total) * 100
          const allocationPercent = kmpTotals.yearTotal > 0
            ? (cTotals.yearTotal / kmpTotals.yearTotal) * 100
            : null;

          childRows.push({
            id: `CHILD_${kmp.id}_${c.unitId}`,
            stt: `${kmpIdx + 1}.${childRows.length + 1}`,
            name: c.unitName,
            level: 'child',
            groupId,
            kmpId: kmp.id,
            allocationPercent,
            months: c.bucket.months,
            ...cTotals
          });
        }
      });

      // Sắp xếp các dòng con giảm dần theo số tiền
      childRows.sort((a, b) => b.yearTotal - a.yearTotal);
      childRows.forEach((r, idx) => {
        r.stt = `${kmpIdx + 1}.${idx + 1}`;
      });

      kmpRowItems.push({
        id: `KMP_${kmp.id}`,
        stt: `${kmpIdx + 1}`,
        name: kmp.dien_giai || kmp.nhom_chi_phi,
        code: kmp.ma_b7 || kmp.ma_b10 || '',
        level: 'kmp',
        groupId,
        kmpId: kmp.id,
        months: kb.months,
        children: childRows,
        ...kmpTotals
      });
    });

    const groupTotals = computeRowTotals(groupMonths, groupPriorMonths);

    // Dòng Nhóm La Mã
    matrixRows.push({
      id: groupId,
      stt: romanStt,
      name: grpName.toUpperCase(),
      level: 'group',
      groupId,
      months: groupMonths,
      children: kmpRowItems,
      ...groupTotals
    });
  });

  // 6. Tổng cộng toàn bộ (Summary)
  const summaryMonths: Record<number, MonthValue> = {};
  const summaryPriorMonths: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    summaryMonths[m] = { amount: 0, isTemporary: false };
    summaryPriorMonths[m] = 0;
  }

  matrixRows.forEach(grp => {
    for (let m = 1; m <= 12; m++) {
      summaryMonths[m].amount += grp.months[m].amount;
      if (grp.months[m].isTemporary && grp.months[m].amount > 0) {
        summaryMonths[m].isTemporary = true;
      }
      summaryPriorMonths[m] += (grp.q1 + grp.q2 + grp.q3 + grp.q4); // computed
    }
  });

  // Tính lại tổng cộng chính xác từ các nhóm
  const summaryTotals = computeRowTotals(summaryMonths, summaryPriorMonths);

  const summary: MatrixSummary = {
    months: summaryMonths,
    ...summaryTotals
  };

  return {
    year,
    rows: matrixRows,
    summary,
    closedMonths,
    unclosedMonths
  };
}
