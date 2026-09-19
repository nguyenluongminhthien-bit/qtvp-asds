import { 
  DNTT, DnttPhanBo, DmKmp, DonVi, PhapNhan, DmBoPhan, 
  BoPhanCap1, BoPhanCap2, ChiPhiThongKe, PivotLayoutConfig 
} from '../../../types';
import { 
  PivotFlatRecord, PivotFieldKey, PivotNode, 
  PivotColumnHeader, PivotTableData 
} from './pivotTypes';
import { isCostManagementUnit, resolveCostManagementUnit, getAllSubordinateIds } from '../../../utils/hierarchy';

export * from './pivotTypes';

export interface BuildFlatOptions {
  phanBoList: DnttPhanBo[];
  dnttList: DNTT[];
  kmpList: DmKmp[];
  donViList: DonVi[];
  fullDonViList?: DonVi[];
  phapNhanList?: PhapNhan[];
  boPhanList?: DmBoPhan[];
  cap1List?: BoPhanCap1[];
  cap2List?: BoPhanCap2[];
  thongKeList?: ChiPhiThongKe[];
  includeTemporary?: boolean;
  onlyAdministrative?: boolean;
  selectedUnitFilter?: string | null;
  allowedUnitIds?: Set<string> | null;
  userPermittedUnitIds?: Set<string> | null;
}

/**
 * Chuyển đổi dữ liệu phân bổ dntt_phan_bo (Live thời gian thực) thành các bản ghi phẳng (Flat records)
 * phục vụ tổng hợp đa chiều cho Pivot Table
 */
export function buildPivotFlatRecords(options: BuildFlatOptions): PivotFlatRecord[] {
  const {
    phanBoList,
    dnttList,
    kmpList,
    donViList,
    fullDonViList = [],
    phapNhanList = [],
    boPhanList = [],
    cap1List = [],
    cap2List = [],
    thongKeList = [],
    includeTemporary = false,
    onlyAdministrative = true,
    selectedUnitFilter,
    allowedUnitIds,
    userPermittedUnitIds
  } = options;

  const records: PivotFlatRecord[] = [];

  // 1. Caches & Maps để tra cứu nhanh
  const allUnits = fullDonViList.length > 0 ? fullDonViList : donViList;

  // Tính toán phạm vi đơn vị được phép (kết hợp phân quyền người dùng và bộ lọc đơn vị đang chọn)
  let effectiveAllowedUnitIds: Set<string> | null = allowedUnitIds || null;
  if (!effectiveAllowedUnitIds) {
    if (selectedUnitFilter && selectedUnitFilter !== 'ALL') {
      const subIds = new Set([selectedUnitFilter, ...getAllSubordinateIds(selectedUnitFilter, allUnits)]);
      if (userPermittedUnitIds) {
        effectiveAllowedUnitIds = new Set([...subIds].filter(id => userPermittedUnitIds.has(id)));
      } else {
        effectiveAllowedUnitIds = subIds;
      }
    } else {
      effectiveAllowedUnitIds = userPermittedUnitIds || null;
    }
  }
  const mgmtUnits = allUnits.filter(isCostManagementUnit);
  const donViMap = new Map<string, DonVi>(allUnits.map(d => [String(d.id), d]));
  const kmpMap = new Map<string, DmKmp>(kmpList.map(k => [String(k.id), k]));
  const dnttMap = new Map<string, DNTT>(dnttList.map(d => [String(d.id), d]));
  const pnMap = new Map<string, PhapNhan>(phapNhanList.map(p => [String(p.id), p]));
  const bpMap = new Map<string, DmBoPhan>(boPhanList.map(b => [String(b.id), b]));
  const cap1Map = new Map<string, string>(cap1List.map(c => [String(c.id || c.ma), c.ten]));
  const cap2Map = new Map<string, string>(cap2List.map(c => [String(c.id || c.ma), c.ten]));

  // Helper quy đổi đơn vị con về Đơn vị Quản trị
  const resolveUnit = (rawUnitId?: string | null): DonVi | undefined => {
    if (!rawUnitId) return undefined;
    const sId = String(rawUnitId);
    const direct = donViMap.get(sId);
    if (direct && isCostManagementUnit(direct)) return direct;
    const parentMgmt = resolveCostManagementUnit(sId, allUnits);
    return parentMgmt || direct;
  };

  // Helper chuẩn hóa Phía
  const resolvePhia = (u?: DonVi): string => {
    if (!u) return 'Khác';
    const m = (u.mien || u.phia || '').trim().toLowerCase();
    if (m.includes('bắc')) return 'Phía Bắc';
    if (m.includes('nam')) return 'Phía Nam';
    if (m.includes('vpđh') || m.includes('văn phòng')) return 'Khối VPĐH';
    return u.phia || u.mien || 'Khác';
  };

  // Helper quy đổi Công ty Tỉnh thành quản trị
  const resolveCongTyTinhThanh = (rawUnitId?: string | null, mgmtUnit?: DonVi): string => {
    const isCttt = (u?: DonVi | null): boolean => {
      if (!u || !u.loai_hinh) return false;
      const lh = u.loai_hinh.trim().toLowerCase();
      return lh === 'công ty tỉnh thành' || lh.includes('công ty tỉnh') || lh.includes('cttt');
    };

    const isVp = (u?: DonVi | null): boolean => {
      if (!u || !u.loai_hinh) return false;
      const lh = u.loai_hinh.trim().toLowerCase();
      return lh.includes('văn phòng') || lh === 'vpđh' || u.cap_quan_ly === 'HO' || u.cap_quan_ly === 'DV_HO';
    };

    // 1. Nếu đơn vị quản trị chính là Công ty Tỉnh thành
    if (isCttt(mgmtUnit)) return mgmtUnit!.ten_don_vi;

    // 2. Tra cứu theo rawUnitId
    const rawUnit = rawUnitId ? donViMap.get(String(rawUnitId)) : undefined;
    if (isCttt(rawUnit)) return rawUnit!.ten_don_vi;

    // 3. Nếu là đơn vị trực thuộc (Showroom con/Xưởng): dò ngược phả hệ theo cap_quan_ly
    const visited = new Set<string>();
    let current = rawUnit || mgmtUnit;
    while (current && !visited.has(String(current.id))) {
      visited.add(String(current.id));
      if (isCttt(current)) {
        return current.ten_don_vi;
      }
      const parentId = String(current.cap_quan_ly || '').trim();
      if (!parentId || parentId === 'HO' || parentId === 'DV_HO') break;
      current = donViMap.get(parentId);
    }

    // 4. Nếu thuộc khối Văn phòng
    if (isVp(mgmtUnit) || isVp(rawUnit)) {
      return 'Khối VPĐH';
    }

    // 5. Dự phòng: Trả về tên đơn vị quản trị
    return mgmtUnit?.ten_don_vi || rawUnit?.ten_don_vi || '(Chưa gán CTTT)';
  };

  // 2. Nạp dữ liệu LIVE thời gian thực từ dntt_phan_bo
  phanBoList.forEach((pb, idx) => {
    const kmp = kmpMap.get(String(pb.id_kmp));
    if (!kmp) return;
    if (onlyAdministrative && kmp.thuoc_bao_cao_hanh_chinh === false) return;

    const dntt = dnttMap.get(String(pb.dntt_id));
    if (!dntt) return;
    if (dntt.trang_thai === 'Từ chối') return;
    if (!includeTemporary && dntt.trang_thai === 'Lưu nháp') return;

    const rawUnitId = dntt.id_don_vi ? String(dntt.id_don_vi) : '';
    const mgmtUnit = resolveUnit(rawUnitId);
    const resolvedUnitId = mgmtUnit ? String(mgmtUnit.id) : rawUnitId;

    // Lọc theo phân quyền và bộ lọc đơn vị đang chọn
    if (effectiveAllowedUnitIds && resolvedUnitId && !effectiveAllowedUnitIds.has(resolvedUnitId) && (!rawUnitId || !effectiveAllowedUnitIds.has(rawUnitId))) {
      return;
    }

    const thang = Number(pb.thang) || 1;
    const nam = Number(pb.nam) || new Date().getFullYear();
    const quy = Math.ceil(thang / 3);
    const so_tien = Number(pb.so_tien) || 0;

    const pn = dntt.id_phap_nhan ? pnMap.get(String(dntt.id_phap_nhan)) : undefined;

    // Xác định Khối (Cấp 1) & Thương hiệu / Bộ phận (Cấp 2)
    let khoiName = '';
    let boPhanName = '';
    if (pb.id_bo_phan) {
      const bp = bpMap.get(String(pb.id_bo_phan));
      if (bp) {
        khoiName = bp.ten_cap1 || bp.ma_cap1;
        boPhanName = bp.ten_cap2 || bp.ma_cap2;
      }
    }
    if (!khoiName && pb.id_bo_phan_cap1) {
      khoiName = cap1Map.get(String(pb.id_bo_phan_cap1)) || String(pb.id_bo_phan_cap1);
    }
    if (!boPhanName && pb.id_bo_phan_cap2) {
      boPhanName = cap2Map.get(String(pb.id_bo_phan_cap2)) || String(pb.id_bo_phan_cap2);
    }

    records.push({
      id: pb.id || `PB_FLAT_${idx}`,
      nam,
      thang,
      quy,
      thang_label: `Tháng ${thang}`,
      quy_label: `Quý ${quy}`,
      phia: resolvePhia(mgmtUnit),
      cong_ty_tinh_thanh: resolveCongTyTinhThanh(rawUnitId, mgmtUnit),
      don_vi_id: resolvedUnitId,
      don_vi: mgmtUnit?.ten_don_vi || `Đơn vị ${resolvedUnitId || '(Chưa gán)'}`,
      loai_hinh: mgmtUnit?.loai_hinh || 'Khác',
      phap_nhan_id: pn ? String(pn.id) : '',
      phap_nhan: pn?.ten_cong_ty || pn?.ten_phap_nhan || '(Chưa gán pháp nhân)',
      nhom_chi_phi: (kmp.nhom_chi_phi || 'Chi phí khác').trim(),
      kmp_id: String(kmp.id),
      kmp: (kmp.dien_giai || kmp.nhom_chi_phi || '').trim(),
      kmp_code: (kmp.ma_b7 || kmp.ma_b10 || '').trim(),
      khoi_nghiep_vu: khoiName || '(Chưa phân loại)',
      thuong_hieu_bo_phan: boPhanName || '(Chưa phân loại)',
      so_tien,
      is_temporary: dntt.trang_thai === 'Lưu nháp',
      thuoc_bao_cao_hanh_chinh: kmp.thuoc_bao_cao_hanh_chinh !== false
    });
  });

  return records;
}

/**
 * Trích xuất giá trị trường của bản ghi theo khóa Dimension
 */
export function getRecordFieldValue(record: PivotFlatRecord, field: PivotFieldKey): { key: string; label: string; sortOrder?: number } {
  switch (field) {
    case 'nam':
      return { key: String(record.nam), label: `Năm ${record.nam}`, sortOrder: record.nam };
    case 'quy':
      return { key: `Q${record.quy}`, label: `Quý ${record.quy}`, sortOrder: record.quy };
    case 'thang':
      return { key: `T${record.thang}`, label: `Tháng ${record.thang}`, sortOrder: record.thang };
    case 'phia':
      return { key: record.phia, label: record.phia };
    case 'cong_ty_tinh_thanh':
      return { key: record.cong_ty_tinh_thanh, label: record.cong_ty_tinh_thanh };
    case 'don_vi':
      return { key: record.don_vi_id || record.don_vi, label: record.don_vi };
    case 'loai_hinh':
      return { key: record.loai_hinh, label: record.loai_hinh };
    case 'phap_nhan':
      return { key: record.phap_nhan_id || record.phap_nhan, label: record.phap_nhan };
    case 'nhom_chi_phi':
      return { key: record.nhom_chi_phi, label: record.nhom_chi_phi };
    case 'kmp':
      return { 
        key: record.kmp_id || record.kmp, 
        label: record.kmp_code ? `${record.kmp_code} - ${record.kmp}` : record.kmp 
      };
    case 'khoi_nghiep_vu':
      return { key: record.khoi_nghiep_vu, label: record.khoi_nghiep_vu };
    case 'thuong_hieu_bo_phan':
      return { key: record.thuong_hieu_bo_phan, label: record.thuong_hieu_bo_phan };
    default:
      return { key: '', label: '' };
  }
}

/**
 * Tổng hợp ma trận Pivot Table theo cấu hình Rows, Columns, Values, Filters
 */
export function computePivotMatrix(
  records: PivotFlatRecord[],
  layout: PivotLayoutConfig
): PivotTableData {
  const { rows = [], cols = [], filters = {} } = layout;

  // 1. Áp dụng bộ lọc (Filters)
  const filteredRecords = records.filter(r => {
    for (const [filterKey, selectedVals] of Object.entries(filters)) {
      if (!selectedVals || selectedVals.length === 0) continue;
      const { key } = getRecordFieldValue(r, filterKey as PivotFieldKey);
      if (!selectedVals.includes(key)) {
        return false;
      }
    }
    return true;
  });

  // 2. Xác định các Cột hiển thị (Leaf Columns)
  // Nếu không chọn trường Cột nào -> 1 cột tổng duy nhất "so_tien_tong"
  const colKeysMap = new Map<string, { key: string; label: string; sortWeight: number }>();

  if (cols.length === 0) {
    colKeysMap.set('TOTAL', { key: 'TOTAL', label: 'Tổng số tiền', sortWeight: 0 });
  } else {
    filteredRecords.forEach(r => {
      const parts: string[] = [];
      const labels: string[] = [];
      let sortWeight = 0;

      cols.forEach((cField, idx) => {
        const { key, label, sortOrder } = getRecordFieldValue(r, cField as PivotFieldKey);
        parts.push(key);
        labels.push(label);
        sortWeight += (sortOrder ?? 0) * Math.pow(100, cols.length - idx);
      });

      const fullKey = parts.join('__');
      if (!colKeysMap.has(fullKey)) {
        colKeysMap.set(fullKey, {
          key: fullKey,
          label: labels.join(' - '),
          sortWeight
        });
      }
    });
  }

  // Sắp xếp các cột theo thứ tự hợp lý (Tháng 1 -> Tháng 12, Quý 1 -> Quý 4, Năm...)
  const leafColumns: PivotColumnHeader[] = Array.from(colKeysMap.values())
    .sort((a, b) => {
      if (a.sortWeight !== b.sortWeight) return a.sortWeight - b.sortWeight;
      return a.label.localeCompare(b.label, 'vi');
    })
    .map(c => ({ key: c.key, label: c.label }));

  // 3. Xây dựng cây phân cấp Hàng (Recursive Row Tree)
  const buildTree = (
    recs: PivotFlatRecord[],
    currentDepth: number,
    parentKeyPrefix: string = ''
  ): PivotNode[] => {
    if (currentDepth >= rows.length) {
      return [];
    }

    const currentField = rows[currentDepth] as PivotFieldKey;
    const groups = new Map<string, { label: string; records: PivotFlatRecord[] }>();

    recs.forEach(r => {
      const { key, label } = getRecordFieldValue(r, currentField);
      if (!groups.has(key)) {
        groups.set(key, { label, records: [] });
      }
      groups.get(key)!.records.push(r);
    });

    // Sắp xếp các nhóm theo chữ cái hoặc thứ tự tự nhiên
    const sortedGroupEntries = Array.from(groups.entries()).sort((a, b) => {
      return a[1].label.localeCompare(b[1].label, 'vi');
    });

    return sortedGroupEntries.map(([groupKey, groupData]) => {
      const fullNodeKey = parentKeyPrefix ? `${parentKeyPrefix}__${groupKey}` : groupKey;
      const values: Record<string, number> = {};
      let nodeTotal = 0;

      // Tính tổng theo từng cột
      groupData.records.forEach(r => {
        let colKey = 'TOTAL';
        if (cols.length > 0) {
          colKey = cols.map(c => getRecordFieldValue(r, c as PivotFieldKey).key).join('__');
        }
        values[colKey] = (values[colKey] || 0) + r.so_tien;
        nodeTotal += r.so_tien;
      });

      const children = buildTree(groupData.records, currentDepth + 1, fullNodeKey);

      return {
        key: fullNodeKey,
        label: groupData.label,
        field: currentField,
        depth: currentDepth,
        values,
        total: nodeTotal,
        count: groupData.records.length,
        children,
        isExpanded: true
      };
    });
  };

  let rootNodes: PivotNode[] = [];
  if (rows.length === 0) {
    // Không chọn dòng nào -> chỉ hiển thị 1 dòng Tổng cộng duy nhất
    const values: Record<string, number> = {};
    let total = 0;
    filteredRecords.forEach(r => {
      let colKey = 'TOTAL';
      if (cols.length > 0) {
        colKey = cols.map(c => getRecordFieldValue(r, c as PivotFieldKey).key).join('__');
      }
      values[colKey] = (values[colKey] || 0) + r.so_tien;
      total += r.so_tien;
    });

    rootNodes = [{
      key: 'ALL_SUMMARY',
      label: 'Tổng cộng chi phí toàn bộ',
      field: 'all',
      depth: 0,
      values,
      total,
      count: filteredRecords.length,
      children: []
    }];
  } else {
    rootNodes = buildTree(filteredRecords, 0);
  }

  // 4. Tính toán Dòng Tổng Cộng (Grand Total)
  const grandTotalByCol: Record<string, number> = {};
  let grandTotalAll = 0;
  filteredRecords.forEach(r => {
    let colKey = 'TOTAL';
    if (cols.length > 0) {
      colKey = cols.map(c => getRecordFieldValue(r, c as PivotFieldKey).key).join('__');
    }
    grandTotalByCol[colKey] = (grandTotalByCol[colKey] || 0) + r.so_tien;
    grandTotalAll += r.so_tien;
  });

  return {
    rootNodes,
    leafColumns,
    grandTotalByCol,
    grandTotalAll,
    grandTotalCount: filteredRecords.length
  };
}
