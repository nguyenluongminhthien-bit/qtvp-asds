// 🟢 HỆ THỐNG CẤU HÌNH MA TRẬN PHÂN QUYỀN THEO PHÂN HỆ (CONFIG-DRIVEN PERMISSION MATRIX)

export interface AdvancedRuleItem {
  id: string;
  label: string;
  type?: 'checkbox' | 'type_select' | 'plate_select' | 'year_select';
  prefix?: string;
  options?: string[];
  warning?: boolean;
  color?: string;
  description?: string;
}

export interface ModuleMatrixItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  hasView: boolean;
  hasCreate: boolean;
  hasUpdate: boolean;
  hasDelete: boolean;
  advancedRules?: AdvancedRuleItem[];
}

export interface ModuleCrudState {
  v: boolean; // Xem (View)
  c: boolean; // Thêm (Create)
  u: boolean; // Sửa (Update)
  d: boolean; // Xóa (Delete)
}

// 🟢 1. DANH SÁCH 12 PHÂN HỆ NGHIỆP VỤ & ĐẶC QUYỀN TÍCH HỢP
export const MODULE_MATRIX_CONFIG: ModuleMatrixItem[] = [
  {
    id: 'TongQuan',
    label: 'Tổng quan Dashboard',
    icon: '📊',
    description: 'Thống kê tổng hợp trực quan dữ liệu toàn hệ thống',
    hasView: true,
    hasCreate: false,
    hasUpdate: false,
    hasDelete: false,
  },
  {
    id: 'CongTy',
    label: 'Thông tin Công ty',
    icon: '🏢',
    description: 'Cơ cấu tổ chức, sơ đồ phòng ban, hệ thống Showroom / Đơn vị',
    hasView: true,
    hasCreate: true,
    hasUpdate: true,
    hasDelete: true,
    advancedRules: [
      {
        id: 'CAN_DELETE_UNIT',
        label: '⚠️ Cho phép Xóa Showroom / Phòng ban / Đơn vị',
        type: 'checkbox',
        warning: true,
        description: 'Chốt an toàn bảo vệ cấu trúc tổ chức công ty. Chỉ bật nếu tài khoản phụ trách tổ chức lại đơn vị.'
      }
    ]
  },
  {
    id: 'NhanSu',
    label: 'Thông tin Nhân sự',
    icon: '👥',
    description: 'Hồ sơ nhân sự, điều chuyển công tác, hợp đồng & thông tin liên hệ',
    hasView: true,
    hasCreate: true,
    hasUpdate: true,
    hasDelete: true,
    advancedRules: [
      {
        id: 'NS_HIDE_SENSITIVE',
        label: 'Ẩn SĐT, Lương, Ngạch bậc',
        type: 'checkbox',
        description: 'Che giấu thông tin nhạy cảm về thu nhập và số liên hệ cá nhân'
      },
      {
        id: 'NS_NO_DETAIL',
        label: 'Cấm xem Chi tiết Hồ sơ cá nhân',
        type: 'checkbox',
        description: 'Chỉ cho phép xem danh sách tóm tắt ngoài bảng, cấm mở popup chi tiết'
      }
    ]
  },
  {
    id: 'Xe',
    label: 'Thông tin Xe',
    icon: '🚗',
    description: 'Hồ sơ phương tiện, đăng kiểm, bảo hiểm, nhật trình & thanh lý',
    hasView: true,
    hasCreate: true,
    hasUpdate: true,
    hasDelete: true,
    advancedRules: [
      {
        id: 'XE_LIMIT',
        label: 'Giới hạn xe xem được theo Biển số (Bỏ trống = Xem tất cả xe thuộc ĐV)',
        type: 'plate_select',
        prefix: 'XE_LIMIT:'
      }
    ]
  },
  {
    id: 'ThietBi',
    label: 'Thông tin TTB VP',
    icon: '💻',
    description: 'Quản lý trang thiết bị, máy móc, linh kiện văn phòng',
    hasView: true,
    hasCreate: true,
    hasUpdate: true,
    hasDelete: true,
    advancedRules: [
      {
        id: 'TB_HIDE_PRICE',
        label: 'Ẩn cột Nguyên giá tài sản',
        type: 'checkbox',
        description: 'Không hiển thị thông tin giá trị tài sản với tài khoản này'
      }
    ]
  },
  {
    id: 'ChiPhi',
    label: 'Quản lý Chi phí (DNTT)',
    icon: '💰',
    description: 'Lập Đề nghị thanh toán, tổng hợp chi phí, chốt kỳ & phân bổ chi phí',
    hasView: true,
    hasCreate: true,
    hasUpdate: true,
    hasDelete: true,
    advancedRules: [
      {
        id: 'CAN_LOCK_PERIOD',
        label: '🔒 Cho phép Chốt số liệu Kỳ Chi phí (DNTT)',
        type: 'checkbox',
        warning: true,
        description: 'Được quyền khóa/mở kỳ chi phí theo Tháng/Năm để chốt dữ liệu kế toán'
      },
      {
        id: 'CP_PIVOT_CLONE',
        label: 'Quyền Báo cáo tuỳ chỉnh (Pivot Table)',
        type: 'checkbox',
        description: 'Được phép tạo và lưu các mẫu bảng báo cáo phân tích chi phí đa chiều'
      }
    ]
  },
  {
    id: 'NhaCungCap',
    label: 'Quản lý Nhà cung cấp',
    icon: '🤝',
    description: 'Danh bạ đối tác cung cấp dịch vụ, hợp đồng & đầu mối liên hệ',
    hasView: true,
    hasCreate: true,
    hasUpdate: true,
    hasDelete: true
  },
  {
    id: 'VanBan',
    label: 'Văn bản - Thông báo',
    icon: '📄',
    description: 'Quản lý văn bản, công văn đi/đến, quyết định, tờ trình & thông báo',
    hasView: true,
    hasCreate: true,
    hasUpdate: true,
    hasDelete: true,
    advancedRules: [
      { id: 'VB_VIEW_QD', label: 'Xem Quyết định', type: 'checkbox' },
      { id: 'VB_VIEW_TB', label: 'Xem Thông báo', type: 'checkbox' },
      { id: 'VB_VIEW_TB_BDH', label: 'Xem Thông báo BĐH', type: 'checkbox' },
      { id: 'VB_VIEW_TT', label: 'Xem Tờ trình', type: 'checkbox' },
      { id: 'VB_VIEW_CV_DI', label: 'Xem Công văn đi', type: 'checkbox' },
      { id: 'VB_VIEW_CV_DEN', label: 'Xem Công văn đến', type: 'checkbox' },
      { id: 'VB_HIDE_BTN', label: 'Ẩn nút Ban hành', type: 'checkbox', warning: true },
      { id: 'VB_YEARS', label: 'Cho phép xem theo Năm', type: 'year_select', prefix: 'VB_YEARS:' }
    ]
  },
  {
    id: 'QuyDinh',
    label: 'Quy định - Quy trình',
    icon: '📖',
    description: 'Quy chế công ty, tài liệu hướng dẫn và quy chuẩn vận hành',
    hasView: true,
    hasCreate: true,
    hasUpdate: true,
    hasDelete: true,
    advancedRules: [
      {
        id: 'QD_TYPES',
        label: 'Phân loại tài liệu xem được',
        type: 'type_select',
        prefix: 'QD_TYPES:',
        options: [
          'Quy định',
          'Quy trình',
          'Hướng dẫn',
          'Quy chế',
          'Quyết định',
          'Thông báo',
          'Thông báo BĐH',
          'Tờ trình',
          'Công văn đi',
          'Công văn đến'
        ]
      },
      { id: 'QD_YEARS', label: 'Cho phép xem theo Năm', type: 'year_select', prefix: 'QD_YEARS:' }
    ]
  },
  {
    id: 'PCCC',
    label: 'Phòng cháy Chữa cháy',
    icon: '🔥',
    description: 'Biên bản kiểm tra an toàn PCCC, trang bị bình chữa cháy, diễn tập',
    hasView: true,
    hasCreate: true,
    hasUpdate: true,
    hasDelete: true
  },
  {
    id: 'ATVSLD',
    label: 'An toàn Vệ sinh LĐ',
    icon: '⛑️',
    description: 'Hồ sơ huấn luyện ATLĐ, khám sức khỏe định kỳ & bảo hộ lao động',
    hasView: true,
    hasCreate: true,
    hasUpdate: true,
    hasDelete: true
  },
  {
    id: 'BaoCao',
    label: 'Báo cáo Tổng hợp',
    icon: '📑',
    description: 'Tổng hợp số liệu xuất báo cáo quản trị toàn diện theo đơn vị',
    hasView: true,
    hasCreate: false,
    hasUpdate: false,
    hasDelete: false
  }
];

// Tập hợp danh sách ID phân hệ hợp lệ
export const ALL_MODULE_IDS = MODULE_MATRIX_CONFIG.map(m => m.id);
export const ALL_MODULE_IDS_SET = new Set(ALL_MODULE_IDS);

// 🟢 2. CÁC HÀM TIỆN ÍCH PHÂN TÍCH VÀ MÃ HÓA MA TRẬN PHÂN QUYỀN

/**
 * Trích xuất quyền CRUD cho 1 module cụ thể từ chuỗi `quyen_chi_tiet`
 * Chuỗi định dạng: "CRUD:CongTy:V|C|U|D"
 */
export const parseModuleCrud = (
  quyenChiTiet: string | undefined,
  moduleId: string
): ModuleCrudState | null => {
  if (!quyenChiTiet || !moduleId) return null;
  const rules = quyenChiTiet.split(',').map(r => r.trim());
  const prefix = `CRUD:${moduleId}:`;
  const rule = rules.find(r => r.startsWith(prefix));
  if (!rule) return null;

  const actions = rule.substring(prefix.length).split('|').map(a => a.trim().toUpperCase());
  return {
    v: actions.includes('V'),
    c: actions.includes('C'),
    u: actions.includes('U'),
    d: actions.includes('D'),
  };
};

/**
 * Trích xuất toàn bộ bảng CRUD của tất cả module từ chuỗi `quyen_chi_tiet`
 */
export const getAllModuleCrudMap = (
  quyenChiTiet: string | undefined,
  quyenTruyCap?: string,
  fallbackDefaults?: { can_view?: boolean; can_create?: boolean; can_update?: boolean; can_delete?: boolean }
): Record<string, ModuleCrudState> => {
  const result: Record<string, ModuleCrudState> = {};
  const isAllAccess = quyenTruyCap === 'ALL';
  const allowedModules = (quyenTruyCap || '').split(',').map(m => m.trim()).filter(Boolean);

  MODULE_MATRIX_CONFIG.forEach(mod => {
    const parsed = parseModuleCrud(quyenChiTiet, mod.id);
    if (parsed) {
      result[mod.id] = parsed;
    } else {
      // Fallback nếu tài khoản cũ chưa có mã CRUD chi tiết theo module
      const isViewAllowed = isAllAccess || (!quyenTruyCap && fallbackDefaults?.can_view !== false) || allowedModules.includes(mod.id);
      result[mod.id] = {
        v: isViewAllowed,
        c: isViewAllowed && mod.hasCreate && fallbackDefaults?.can_create !== false,
        u: isViewAllowed && mod.hasUpdate && fallbackDefaults?.can_update !== false,
        d: isViewAllowed && mod.hasDelete && Boolean(fallbackDefaults?.can_delete),
      };
    }
  });

  return result;
};

/**
 * Mã hóa trạng thái CRUD của 1 module thành định dạng chuỗi: "CRUD:ModuleName:V|C|U|D"
 */
export const encodeModuleCrud = (moduleId: string, state: ModuleCrudState): string => {
  const actions: string[] = [];
  if (state.v) actions.push('V');
  if (state.c) actions.push('C');
  if (state.u) actions.push('U');
  if (state.d) actions.push('D');
  if (actions.length === 0) return '';
  return `CRUD:${moduleId}:${actions.join('|')}`;
};

/**
 * Cập nhật trạng thái CRUD của 1 module vào chuỗi `quyen_chi_tiet`
 */
export const updateModuleCrudInRules = (
  quyenChiTiet: string | undefined,
  moduleId: string,
  newState: ModuleCrudState
): string => {
  const currentRules = (quyenChiTiet || '').split(',').map(r => r.trim()).filter(Boolean);
  const prefix = `CRUD:${moduleId}:`;
  const filtered = currentRules.filter(r => !r.startsWith(prefix));

  const encoded = encodeModuleCrud(moduleId, newState);
  if (encoded) {
    filtered.push(encoded);
  }

  return filtered.join(',');
};

/**
 * Đồng bộ chuỗi quyen_chi_tiet sang các cờ boolean và danh sách quyen_truy_cap
 */
export const syncRulesToFormState = (
  crudMap: Record<string, ModuleCrudState>,
  quyenChiTiet: string
) => {
  let anyView = false;
  let anyCreate = false;
  let anyUpdate = false;
  let anyDelete = false;
  const viewableModules: string[] = [];

  Object.entries(crudMap).forEach(([modId, state]) => {
    if (state.v) {
      anyView = true;
      viewableModules.push(modId);
    }
    if (state.c) anyCreate = true;
    if (state.u) anyUpdate = true;
    if (state.d) anyDelete = true;
  });

  const rulesList = (quyenChiTiet || '').split(',').map(r => r.trim()).filter(Boolean);
  const canDeleteUnit = rulesList.includes('CAN_DELETE_UNIT');
  const canLockPeriod = rulesList.includes('CAN_LOCK_PERIOD');

  return {
    can_view: anyView,
    can_create: anyCreate,
    can_update: anyUpdate,
    can_delete: anyDelete,
    can_delete_unit: canDeleteUnit,
    can_lock_period: canLockPeriod,
    quyen_truy_cap: viewableModules.length === MODULE_MATRIX_CONFIG.length ? 'ALL' : viewableModules.join(',')
  };
};
