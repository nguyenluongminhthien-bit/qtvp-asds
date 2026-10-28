import { INITIAL_MOCK_DATA } from '../services/api/mockData';
import { getLocalRecords } from '../services/api/localStore';
import { apiCache } from '../services/api/cache';
import { toast } from './toast';

export interface ExcelTemplateConfig {
  filename: string;
  headers: string[];
  dummyRow: string[];
}

export const EXCEL_TEMPLATES: Record<string, ExcelTemplateConfig> = {
  personnel: {
    filename: 'Mau_Form_Them_Nhan_Su_Hang_Loat.xls',
    headers: [
      "Số TT", "Mã", "Họ tên", "Chức danh", "Chức vụ", "Bộ phận làm việc",
      "Đơn vị công tác", "Showroom", "Phía", "SDT Cty", "Giới tính", "Năm sinh", "Ngày nhận việc",
      "SDT CN", "Email", "Ngạch", "Nhóm", "Từ", "Đến", "Giá trị", "Khối",
      "Địa điểm làm việc", "CCCD", "Thẻ thang (True/False)", "Thẻ xe (True/False)", "Hãng-Loại xe", "BKS",
      "Địa chỉ", "Đơn vị chi lương"
    ],
    dummyRow: [
      "1", "2112277", "Nguyễn Văn A", "Chuyên viên", "Trưởng bộ phận", "QTVP",
      "THACO AUTO An Giang", "Showroom Kia An Giang", "Nam", "0901234567", "Nam", "1990", "01/01/2020",
      "0987654321", "nguyenvana@thaco.com.vn", "G2", "4", "", "", "", "Khối Văn phòng",
      "VP Sadora (HCM)", "079090123456", "TRUE", "TRUE", "Yamaha Exciter", "66F118251",
      "Số 10 Mai Chí Thọ, P. An Lợi Đông, TP. Thủ Đức, TP.HCM", "Công ty Cổ phần Tập đoàn Trường Hải"
    ]
  },
  osh_training: {
    filename: 'Mau_Form_Them_Hoc_Vien_ATVSLD_Hang_Loat.xls',
    headers: [
      "STT", "MSNV *", "Họ và tên", "Ngày sinh", "Giới tính",
      "Số CCCD", "Quốc tịch", "Chức vụ", "Đơn vị", "Nhóm (1-6)",
      "Nội dung huấn luyện", "Thời gian huấn luyện", "Điểm lý thuyết",
      "Điểm thực hành", "Kết quả", "Ghi chú"
    ],
    dummyRow: [
      "1", "22091296", "Nguyễn Thị Hoàng Yến", "24/12/2000", "Nữ",
      "082300009847", "Việt Nam", "Hỗ trợ bán hàng", "Công ty TNHH THACO AUTO TP.HCM (Showroom Bình Triệu)", "4",
      "- Kiến thức cơ bản về an toàn, vệ sinh lao động\n- Nội dung huấn luyện trực tiếp tại nơi làm việc",
      "06/05 - 07/05/2026", "65", "60", "Đạt", "Định kỳ"
    ]
  },
  strict_equipment: {
    filename: 'Mau_Form_Them_Thiet_Bi_Nghiem_Ngat_Hang_Loat.xls',
    headers: [
      "Số TT", "Số Serial", "Tên Thiết bị *", "Mã Thiết bị", "Mã Chế tạo",
      "Thông số KT", "Ngày Kiểm định *", "Hiệu lực KĐ", "Hạn Kiểm định *",
      "Người Ký", "Đơn vị", "Giá thành", "Định kì/bất thường",
      "Cấp lý lịch", "Người hỗ trợ", "Tình Trạng Hồ Sơ Lưu Trữ"
    ],
    dummyRow: [
      "135", "0135/2026", "CẦU NÂNG Ô TÔ BỐN TRỤ", "TN-3000", "TN-3000-01", "3,0 Tấn",
      "21/01/2026", "1 Năm", "21/01/2027", "NGUYỄN CHU TẤN", "THACO GÒ VẤP",
      "1500000", "Định kì", "", "Trần Quốc Bảo", "Đủ biên bản"
    ]
  },
  office_equipment: {
    filename: 'Mau_Form_Them_Trang_Thiet_Bi_Van_Phong_Hang_Loat.xls',
    headers: [
      "Mã tài sản *", "Tên thiết bị *", "Đơn vị", "Nhóm thiết bị", "Số lượng",
      "Đơn vị tính", "Vị trí bố trí", "Nhà cung cấp", "Ngày mua", "Giá mua",
      "Hạn bảo hành", "Thời gian khấu hao", "Tài sản thuộc", "CPU", "RAM",
      "SSD", "HDD", "VGA", "Màn hình", "Thông số kỹ thuật chung", "Tình trạng",
      "Quy cách/chất liệu", "Số seri", "Phụ kiện/Ghi chú thêm", "Mô tả đặc điểm",
      "Link hồ sơ", "Link hình ảnh"
    ],
    dummyRow: [
      "TS-IT-001", "PC Gaming Văn Phòng HP ProTower", "Showroom Bình Dương", "Máy móc CNTT (PC, Laptop, Server...)", "1",
      "Bộ", "Phòng Kế Toán - Tầng 2", "Phong Vũ IT", "2023-05-10", "18500000",
      "2025-05-10", "36 tháng", "Công ty sở hữu", "Core i7 12700", "16 GB",
      "512 GB", "1 TB", "GTX 1650", "Dell 24 inch", "Core i7 12700, RAM 16 GB, SSD 512 GB", "Tốt",
      "Kim loại/Nhựa", "PCDELL12345", "Chuột, phím, tai nghe", "Core i7, RAM 16GB, SSD 512GB",
      "", ""
    ]
  },
  ksk_canhan: {
    filename: 'Mau_Form_Kham_Suc_Khoe_Nhan_Su_Hang_Loat.xls',
    headers: [
      "STT", "MSNV *", "Họ và tên *", "Năm KSK *", "Mã Gói khám",
      "Phân loại SK (Loại I - V)", "Kết luận BNN", "Tên bệnh nghề nghiệp", "Ghi chú sức khỏe"
    ],
    dummyRow: [
      "1", "22091296", "Nguyễn Thị Hoàng Yến", "2025", "GK 3A",
      "Loại II", "Nguy cơ BNN", "Giảm thính lực nhẹ", "Cần kiểm tra lại thị lực"
    ]
  }
};

export const getMostCompleteEquipmentDummyRow = (items: any[], donViMap?: Record<string, string>): string[] | undefined => {
  if (!items || items.length === 0) return undefined;

  const itemsWithScores = items.map((item, originalIndex) => {
    let filledCount = 0;
    let textLength = 0;

    Object.keys(item).forEach(k => {
      const val = item[k];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        filledCount += 1;
        textLength += String(val).trim().length;
      }
    });

    let recencyTimestamp = originalIndex;
    const strId = String(item.id || item.ID || '');
    const tsMatch = strId.match(/\d{10,}/);
    if (tsMatch) {
      recencyTimestamp = Number(tsMatch[0]);
    } else if (item.created_at) {
      const t = new Date(item.created_at).getTime();
      if (!isNaN(t)) recencyTimestamp = t;
    } else if (item.ngay_mua) {
      const t = new Date(item.ngay_mua).getTime();
      if (!isNaN(t)) recencyTimestamp = t;
    }

    return {
      item,
      filledCount,
      textLength,
      recencyTimestamp,
      originalIndex
    };
  });

  // Ưu tiên: filledCount cao nhất -> recencyTimestamp mới nhất -> textLength lớn nhất
  itemsWithScores.sort((a, b) => {
    if (b.filledCount !== a.filledCount) {
      return b.filledCount - a.filledCount;
    }
    if (b.recencyTimestamp !== a.recencyTimestamp) {
      return b.recencyTimestamp - a.recencyTimestamp;
    }
    if (b.textLength !== a.textLength) {
      return b.textLength - a.textLength;
    }
    return b.originalIndex - a.originalIndex;
  });

  const bestItem = itemsWithScores[0]?.item;
  if (!bestItem) return undefined;

  const dvName = (donViMap && donViMap[bestItem.id_don_vi]) || bestItem.ten_don_vi || '';

  return [
    bestItem.ma_tai_san || '',
    bestItem.ten_thiet_bi || '',
    dvName || '',
    bestItem.nhom_thiet_bi || '',
    String(bestItem.so_luong !== undefined && bestItem.so_luong !== null ? bestItem.so_luong : '1'),
    bestItem.don_vi_tinh || 'Cái',
    bestItem.vi_tri_bo_tri || '',
    bestItem.nha_cung_cap || '',
    bestItem.ngay_mua || '',
    bestItem.gia_mua !== undefined && bestItem.gia_mua !== null ? String(bestItem.gia_mua) : '',
    bestItem.han_bao_hanh || '',
    bestItem.thoi_gian_khau_hao || '',
    bestItem.tai_san_thuoc || '',
    bestItem.cpu || '',
    bestItem.ram || '',
    bestItem.ssd || '',
    bestItem.hdd || '',
    bestItem.vga || '',
    bestItem.man_hinh || '',
    bestItem.thong_so_ky_thuat || '',
    bestItem.tinh_trang || 'Đang sử dụng',
    bestItem.quy_cach_chat_lieu || '',
    bestItem.so_seri || '',
    bestItem.phu_kien || '',
    bestItem.mo_ta_dac_diem || '',
    bestItem.link_ho_so || '',
    bestItem.link_hinh_anh || ''
  ];
};

export const getMostCompletePersonnelDummyRow = (items: any[], donViMap?: Record<string, string>): string[] | undefined => {
  if (!items || items.length === 0) return undefined;

  const itemsWithScores = items.map((item, originalIndex) => {
    let filledCount = 0;
    let textLength = 0;

    Object.keys(item).forEach(k => {
      const val = item[k];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        filledCount += 1;
        textLength += String(val).trim().length;
      }
    });

    let recencyTimestamp = originalIndex;
    const strId = String(item.id || item.ID || '');
    const tsMatch = strId.match(/\d{10,}/);
    if (tsMatch) {
      recencyTimestamp = Number(tsMatch[0]);
    } else if (item.created_at) {
      const t = new Date(item.created_at).getTime();
      if (!isNaN(t)) recencyTimestamp = t;
    } else if (item.ngay_nhan_viec) {
      const t = new Date(item.ngay_nhan_viec).getTime();
      if (!isNaN(t)) recencyTimestamp = t;
    }

    return {
      item,
      filledCount,
      textLength,
      recencyTimestamp,
      originalIndex
    };
  });

  // Ưu tiên: filledCount cao nhất -> recencyTimestamp mới nhất -> textLength lớn nhất
  itemsWithScores.sort((a, b) => {
    if (b.filledCount !== a.filledCount) {
      return b.filledCount - a.filledCount;
    }
    if (b.recencyTimestamp !== a.recencyTimestamp) {
      return b.recencyTimestamp - a.recencyTimestamp;
    }
    if (b.textLength !== a.textLength) {
      return b.textLength - a.textLength;
    }
    return b.originalIndex - a.originalIndex;
  });

  const bestItem = itemsWithScores[0]?.item;
  if (!bestItem) return undefined;

  const dvName = (donViMap && donViMap[bestItem.id_don_vi]) || bestItem.ten_don_vi || '';

  return [
    "1",
    bestItem.ma_so_nhan_vien || bestItem.msnv || '',
    bestItem.ho_ten || '',
    bestItem.chuc_danh || bestItem.phan_loai || '',
    bestItem.chuc_vu || '',
    bestItem.phong_ban || bestItem.bo_phan || '',
    dvName || '',
    bestItem.showroom || '',
    bestItem.phia || '',
    bestItem.sdt_cong_ty || '',
    bestItem.gioi_tinh || '',
    bestItem.nam_sinh ? String(bestItem.nam_sinh) : '',
    bestItem.ngay_nhan_vien || bestItem.ngay_nhan_viec || bestItem.ngay_lam || '',
    bestItem.sdt_ca_nhan || '',
    bestItem.email || '',
    bestItem.ngach_luong || bestItem.ngach || '',
    bestItem.nhom_doi_tuong || bestItem.nhom_atvsld || '',
    bestItem.huan_luyen_tu || bestItem.hl_tu || '',
    bestItem.huan_luyen_den || bestItem.hl_den || '',
    bestItem.gia_tri_den || '',
    bestItem.khoi || '',
    bestItem.dia_diem_lam_viec || bestItem.dia_diem_lv || '',
    bestItem.cccd || bestItem.so_cccd || '',
    bestItem.the_thang !== undefined && bestItem.the_thang !== null ? String(bestItem.the_thang) : '',
    bestItem.the_xe || '',
    bestItem.hang_loai_xe || '',
    bestItem.bks || bestItem.bien_kiem_soat || '',
    bestItem.dia_chi || '',
    bestItem.dv_chi_luong || ''
  ];
};

export const downloadExcelTemplate = (moduleKey: keyof typeof EXCEL_TEMPLATES, customDummyRow?: string[]) => {
  const config = EXCEL_TEMPLATES[moduleKey];
  if (!config) {
    console.error(`Không tìm thấy cấu hình form mẫu cho module: ${moduleKey}`);
    return;
  }

  let rowToUse = customDummyRow && customDummyRow.length === config.headers.length ? customDummyRow : config.dummyRow;

  if (moduleKey === 'office_equipment' && !customDummyRow) {
    // Đọc dữ liệu từ live cache -> localStore -> initial mock
    let itemsToScan: any[] = [];
    if (apiCache['ts_thiet_bi']?.data && Array.isArray(apiCache['ts_thiet_bi'].data) && apiCache['ts_thiet_bi'].data.length > 0) {
      itemsToScan = apiCache['ts_thiet_bi'].data;
    } else {
      const local = getLocalRecords('ts_thiet_bi');
      itemsToScan = (local && local.length > 0) ? local : INITIAL_MOCK_DATA.ts_thiet_bi;
    }

    const donViList = getLocalRecords('dm_don_vi');
    const donViMap: Record<string, string> = {};
    if (donViList && Array.isArray(donViList)) {
      donViList.forEach((u: any) => { donViMap[u.id] = u.ten_don_vi; });
    }

    const dbSample = getMostCompleteEquipmentDummyRow(itemsToScan, donViMap);
    if (dbSample) rowToUse = dbSample;
  } else if (moduleKey === 'personnel' && !customDummyRow) {
    // Đọc dữ liệu từ live cache -> localStore -> initial mock cho nhân sự
    let itemsToScan: any[] = [];
    if (apiCache['ns_dich_vu']?.data && Array.isArray(apiCache['ns_dich_vu'].data) && apiCache['ns_dich_vu'].data.length > 0) {
      itemsToScan = apiCache['ns_dich_vu'].data;
    } else {
      const local = getLocalRecords('ns_dich_vu');
      itemsToScan = (local && local.length > 0) ? local : INITIAL_MOCK_DATA.ns_dich_vu;
    }

    const donViList = getLocalRecords('dm_don_vi');
    const donViMap: Record<string, string> = {};
    if (donViList && Array.isArray(donViList)) {
      donViList.forEach((u: any) => { donViMap[u.id] = u.ten_don_vi; });
    }

    const dbSample = getMostCompletePersonnelDummyRow(itemsToScan, donViMap);
    if (dbSample) rowToUse = dbSample;
  }

  const headerHTML = config.headers.map(h => `<th>${h}</th>`).join('');
  const dummyHTML = rowToUse.map(d => `<td>${d || ''}</td>`).join('');

  const tableHTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>table { border-collapse: collapse; font-family: 'Arial', sans-serif; } th, td { border: 1px solid #000000; padding: 6px; vertical-align: middle; } .header { background-color: #d9e1f2; color: #000000; font-weight: bold; text-align: center; }</style></head><body><table><thead><tr class="header">${headerHTML}</tr></thead><tbody><tr>${dummyHTML}</tr></tbody></table></body></html>`;

  const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = config.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(`Đã tải mẫu form thêm hàng loạt thành công!`);
};
