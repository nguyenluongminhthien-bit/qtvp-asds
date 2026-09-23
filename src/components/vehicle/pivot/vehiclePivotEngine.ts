import { TS_Xe, DonVi } from '../../../types';
import {
  VehiclePivotFieldKey,
  VehiclePivotFlatRecord,
  VehiclePivotNode,
  VehiclePivotColumnHeader,
  VehiclePivotTableData,
  VehiclePivotLayoutConfig,
  VehiclePivotMeasure
} from './vehiclePivotTypes';
import { parseVehicleLocation } from '../../../utils/vehicleLocationHelper';

export * from './vehiclePivotTypes';

interface BuildVehicleFlatOptions {
  cars: (TS_Xe & any)[];
  donViList: DonVi[];
  donViMap: Record<string, string>;
  nhatKyData?: any[];
  chiPhiData?: any[];
}

/**
 * Tính toán trạng thái hạn Đăng kiểm / Bảo hiểm: Còn hạn / Sắp hết hạn (<= 30 ngày) / Quá hạn / Chưa có ngày
 */
function getExpiryStatusText(dateStr?: string | null): string {
  if (!dateStr) return 'Chưa nhập';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  if (isNaN(target.getTime())) return 'Chưa nhập';
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Quá hạn';
  if (diffDays <= 30) return 'Sắp hết hạn';
  return 'Còn hạn';
}

/**
 * Chuyển đổi danh sách TS_Xe thành danh sách bản ghi phẳng (Flat Records)
 * kết hợp dữ liệu Nhật ký (Km) và Chi phí vận hành
 */
export function buildVehiclePivotFlatRecords(options: BuildVehicleFlatOptions): VehiclePivotFlatRecord[] {
  const { cars, donViList, donViMap, nhatKyData = [], chiPhiData = [] } = options;

  // 1. Precompute tổng Km theo biển số
  const kmMap = new Map<string, number>();
  nhatKyData.forEach(log => {
    if (!log.bien_so) return;
    const bs = String(log.bien_so).trim();
    kmMap.set(bs, (kmMap.get(bs) || 0) + (Number(log.tong_km) || 0));
  });

  // 2. Precompute chi phí theo id_ts_xe hoặc id_phuong_tien
  const costMap = new Map<string, number>();
  chiPhiData.forEach(cp => {
    const carId = String(cp.id_ts_xe || cp.id_phuong_tien || '');
    if (!carId) return;
    const total =
      (Number(cp.cp_nhien_lieu) || 0) +
      (Number(cp.cp_cau_duong_ben_bai) || 0) +
      (Number(cp.cp_rua_xe) || 0) +
      (Number(cp.cp_bao_duong_sua_chua) || 0) +
      (Number(cp.cp_thue_khau_hao) || 0) +
      (Number(cp.cp_dang_kiem) || 0) +
      (Number(cp.cp_bh_tnds) || 0) +
      (Number(cp.cp_bh_vc) || 0);
    costMap.set(carId, (costMap.get(carId) || 0) + total);
  });

  // 3. Đơn vị Cache Map
  const dvMap = new Map<string, DonVi>(donViList.map(d => [String(d.id), d]));

  // 4. Flatten từng xe
  return cars.map(car => {
    const carId = String(car.id);
    const bienSo = String(car.bien_so || '').trim();
    const unit = dvMap.get(String(car.id_don_vi));

    // Tìm Công ty Tỉnh thành
    let ctttName = unit?.ten_don_vi || '(Chưa xác định)';
    let currUnit = unit;
    let depth = 0;
    while (currUnit && depth < 5) {
      const lh = (currUnit.loai_hinh || '').toLowerCase();
      if (lh.includes('công ty tỉnh') || lh.includes('cttt')) {
        ctttName = currUnit.ten_don_vi;
        break;
      }
      if (currUnit.cap_quan_ly && currUnit.cap_quan_ly !== 'HO') {
        currUnit = dvMap.get(String(currUnit.cap_quan_ly));
      } else {
        break;
      }
      depth++;
    }

    // Miền / Phía
    let phia = unit?.mien || unit?.phia || '';
    if (!phia) {
      const uName = (unit?.ten_don_vi || '').toLowerCase();
      if (uName.includes('bắc')) phia = 'Phía Bắc';
      else if (uName.includes('nam')) phia = 'Phía Nam';
      else if (uName.includes('vpđh') || uName.includes('văn phòng')) phia = 'Khối VPĐH';
      else phia = 'Phía Nam';
    }

    // Địa điểm sử dụng 3 cấp
    const loc = parseVehicleLocation(car.dia_diem_su_dung);
    const cap1Name = loc.cap1_ten || (loc.cap1_id && donViMap[loc.cap1_id]) || (loc.dia_chi_day_du ? loc.dia_chi_day_du : '(Chưa gán)');
    const cap2Name = loc.cap2_ten || (loc.cap2_id && donViMap[loc.cap2_id]) || '';
    const cap3Name = loc.cap3_ten || (loc.cap3_id && donViMap[loc.cap3_id]) || '';

    return {
      id: carId,
      bien_so: bienSo,
      don_vi_id: String(car.id_don_vi || ''),
      don_vi: unit?.ten_don_vi || donViMap[car.id_don_vi] || '(Chưa phân đơn vị)',
      cong_ty_tinh_thanh: ctttName,
      phia: phia,
      dia_diem_cap1: cap1Name,
      dia_diem_cap2: cap2Name || '(Không có cấp 2)',
      dia_diem_cap3: cap3Name || '(Không có cấp 3)',
      muc_dich_su_dung: car.muc_dich_su_dung || 'Xe công',
      hieu_xe: car.hieu_xe || 'Khác',
      loai_xe: car.loai_xe || '(Chưa rõ dòng)',
      loai_phuong_tien: car.loai_phuong_tien || 'Ô tô du lịch',
      nam_sx: String(car.nam_sx || 'Chưa rõ'),
      so_cho: car.so_cho ? `${car.so_cho} chỗ` : 'Chưa rõ',
      loai_nhien_lieu: car.loai_nhien_lieu || 'Xăng',
      mau_xe: car.mau_xe || 'Chưa rõ',
      gps: car.gps || 'Không có',
      hien_trang: car.hien_trang || 'Đang hoạt động',
      hinh_thuc_so_huu: car.hinh_thuc_so_huu || 'Sở hữu',
      don_vi_chu_so_huu: car.don_vi_chu_so_huu || '(Theo CSH đơn vị)',
      trang_thai_dang_kiem: getExpiryStatusText(car.han_dang_kiem),
      trang_thai_bh_tnds: getExpiryStatusText(car.han_bh_tnds),
      trang_thai_bh_vc: getExpiryStatusText(car.han_bh_vc),
      nguyen_gia: Number(car.nguyen_gia) || 0,
      tong_km: kmMap.get(bienSo) || 0,
      chi_phi: costMap.get(carId) || 0
    };
  });
}

/**
 * Lấy nhãn và khóa phân loại của 1 trường trên bản ghi
 */
export function getVehicleFieldValue(
  record: VehiclePivotFlatRecord,
  field: VehiclePivotFieldKey
): { key: string; label: string; sortOrder?: number } {
  const val = record[field as keyof VehiclePivotFlatRecord];
  const strVal = String(val !== undefined && val !== null ? val : '').trim();

  switch (field) {
    case 'nam_sx': {
      const num = Number(strVal);
      return { key: strVal || 'Chưa rõ', label: strVal || 'Chưa rõ', sortOrder: isNaN(num) ? 0 : num };
    }
    case 'trang_thai_dang_kiem':
    case 'trang_thai_bh_tnds':
    case 'trang_thai_bh_vc': {
      let order = 1;
      if (strVal === 'Quá hạn') order = 4;
      else if (strVal === 'Sắp hết hạn') order = 3;
      else if (strVal === 'Còn hạn') order = 2;
      return { key: strVal || 'Chưa rõ', label: strVal || 'Chưa rõ', sortOrder: order };
    }
    case 'hien_trang': {
      let order = 1;
      if (strVal === 'Đang hoạt động') order = 5;
      else if (strVal === 'Sửa chữa') order = 4;
      else if (strVal === 'Chuyển KD xe QSD') order = 3;
      else if (strVal === 'Ngưng hoạt động') order = 2;
      else if (strVal === 'Đã Thanh lý') order = 1;
      return { key: strVal || 'Khác', label: strVal || 'Khác', sortOrder: order };
    }
    default:
      return { key: strVal || '(Trống)', label: strVal || '(Trống)' };
  }
}

/**
 * Trích xuất giá trị số đo lường (Measure) từ bản ghi
 */
function getMeasureValue(record: VehiclePivotFlatRecord, measure: VehiclePivotMeasure): number {
  switch (measure) {
    case 'count':
      return 1;
    case 'nguyen_gia':
      return record.nguyen_gia || 0;
    case 'tong_km':
      return record.tong_km || 0;
    case 'chi_phi':
      return record.chi_phi || 0;
    default:
      return 1;
  }
}

/**
 * Động cơ tính toán Ma trận Pivot cho Dữ liệu Xe
 */
export function computeVehiclePivotMatrix(
  records: VehiclePivotFlatRecord[],
  layout: VehiclePivotLayoutConfig
): VehiclePivotTableData {
  const { rows = [], cols = [], valField = 'count', filters = {} } = layout;

  // 1. Áp dụng bộ lọc (Filters)
  const filteredRecords = records.filter(r => {
    for (const [filterKey, selectedVals] of Object.entries(filters)) {
      if (!selectedVals || selectedVals.length === 0) continue;
      const { key } = getVehicleFieldValue(r, filterKey as VehiclePivotFieldKey);
      if (!selectedVals.includes(key)) {
        return false;
      }
    }
    return true;
  });

  // 2. Xác định các Cột hiển thị (Leaf Columns)
  const colKeysMap = new Map<string, { key: string; label: string; sortWeight: number }>();

  if (cols.length === 0) {
    const labelMeasureMap: Record<VehiclePivotMeasure, string> = {
      count: 'Số lượng xe (Chiếc)',
      nguyen_gia: 'Tổng nguyên giá (VNĐ)',
      tong_km: 'Tổng số Km (Km)',
      chi_phi: 'Tổng chi phí (VNĐ)'
    };
    colKeysMap.set('TOTAL', { key: 'TOTAL', label: labelMeasureMap[valField] || 'Tổng số', sortWeight: 0 });
  } else {
    filteredRecords.forEach(r => {
      const parts: string[] = [];
      const labels: string[] = [];
      let sortWeight = 0;

      cols.forEach((cField, idx) => {
        const { key, label, sortOrder } = getVehicleFieldValue(r, cField);
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

  // Sắp xếp cột hợp lý
  const leafColumns: VehiclePivotColumnHeader[] = Array.from(colKeysMap.values())
    .sort((a, b) => {
      if (a.sortWeight !== b.sortWeight) return a.sortWeight - b.sortWeight;
      return a.label.localeCompare(b.label, 'vi');
    })
    .map(c => ({ key: c.key, label: c.label }));

  // Helper lấy ColKey của 1 bản ghi
  const getColKey = (r: VehiclePivotFlatRecord): string => {
    if (cols.length === 0) return 'TOTAL';
    return cols.map(cField => getVehicleFieldValue(r, cField).key).join('__');
  };

  // 3. Xây dựng cây phân cấp Hàng (Recursive Row Tree)
  const buildTree = (
    recs: VehiclePivotFlatRecord[],
    currentDepth: number,
    parentKeyPrefix: string = ''
  ): VehiclePivotNode[] => {
    if (currentDepth >= rows.length) {
      return [];
    }

    const currentField = rows[currentDepth];
    const groups = new Map<string, { label: string; sortOrder?: number; records: VehiclePivotFlatRecord[] }>();

    recs.forEach(r => {
      const { key, label, sortOrder } = getVehicleFieldValue(r, currentField);
      if (!groups.has(key)) {
        groups.set(key, { label, sortOrder, records: [] });
      }
      groups.get(key)!.records.push(r);
    });

    const sortedGroupKeys = Array.from(groups.keys()).sort((aKey, bKey) => {
      const gA = groups.get(aKey)!;
      const gB = groups.get(bKey)!;
      if (gA.sortOrder !== undefined && gB.sortOrder !== undefined && gA.sortOrder !== gB.sortOrder) {
        return gB.sortOrder - gA.sortOrder; // Số lớn xếp trước (năm lớn xếp trước)
      }
      return gA.label.localeCompare(gB.label, 'vi');
    });

    return sortedGroupKeys.map(groupKey => {
      const group = groups.get(groupKey)!;
      const nodeKey = parentKeyPrefix ? `${parentKeyPrefix}__${groupKey}` : groupKey;

      // Tính tổng giá trị theo từng cột cho Node này
      const colValues: Record<string, number> = {};
      let nodeTotal = 0;

      group.records.forEach(r => {
        const cKey = getColKey(r);
        const val = getMeasureValue(r, valField);
        colValues[cKey] = (colValues[cKey] || 0) + val;
        nodeTotal += val;
      });

      // Tạo các Node con đệ quy
      const children = buildTree(group.records, currentDepth + 1, nodeKey);

      return {
        key: nodeKey,
        label: group.label,
        field: currentField,
        depth: currentDepth,
        values: colValues,
        total: nodeTotal,
        count: group.records.length,
        children,
        isExpanded: true
      };
    });
  };

  const rootNodes = rows.length > 0 ? buildTree(filteredRecords, 0) : [];

  // 4. Tính toán Dòng Tổng cộng Biên (Grand Totals)
  const grandTotalByCol: Record<string, number> = {};
  let grandTotalAll = 0;

  filteredRecords.forEach(r => {
    const cKey = getColKey(r);
    const val = getMeasureValue(r, valField);
    grandTotalByCol[cKey] = (grandTotalByCol[cKey] || 0) + val;
    grandTotalAll += val;
  });

  return {
    rootNodes,
    leafColumns,
    grandTotalByCol,
    grandTotalAll,
    grandTotalCount: filteredRecords.length
  };
}
