import { DonVi } from '../types';

// 1. Hàm tự động cấp Icon (Emoji) dùng cho các danh sách xổ xuống (Select)
export const getUnitEmoji = (loai_hinh?: string) => {
  // Dùng .trim() để xóa khoảng trắng thừa từ Google Sheets
  const lower = String(loai_hinh || '').toLowerCase().trim();
  if (lower.includes('tổng công ty')) return '🏢';
  if (lower.includes('công ty tỉnh thành')) return '🏬';
  if (lower.includes('vp công ty') || lower.includes('văn phòng công ty')) return '💼';
  if (lower.includes('quản trị')) return '🏪';
  if (lower.includes('showroom')) return '🏣';
  if (lower.includes('điểm kinh doanh')) return '📍';
  if (lower.includes('kho')) return '🔩';
  if (lower.includes('xưởng dịch vụ')) return '🛠️';
  if (lower.includes('nhà máy')) return '🏭';
  return '🏢';
};

// 🟢 1. Hàm dùng chung để sắp xếp bất kỳ danh sách nào theo cột "thu_tu"
export const sortDonViByThuTu = (units: any[]) => {
  return [...units].sort((a, b) => (Number(a.thu_tu) || 0) - (Number(b.thu_tu) || 0));
};

// 🟢 2. Hàm dùng chung để phân nhóm Phía Nam, Phía Bắc, VPĐH
export const groupParentUnits = (parentUnits: any[]) => {
  // Sắp xếp toàn bộ theo cột thu_tu trước
  const sortedParents = sortDonViByThuTu(parentUnits);

  // Lọc ra từng nhóm (Lúc này các nhóm đã tự động kế thừa đúng thứ tự)
  const vpdhUnits = sortedParents.filter(u => String(u.phia || '').toLowerCase().includes('vpđh') || String(u.loai_hinh || '').toLowerCase().includes('tổng công ty') || String(u.loai_hinh || '').toLowerCase().includes('văn phòng'));
  const ctttNamUnits = sortedParents.filter(u => !vpdhUnits.includes(u) && String(u.phia || '').toLowerCase().includes('nam'));
  const ctttBacUnits = sortedParents.filter(u => !vpdhUnits.includes(u) && !ctttNamUnits.includes(u) && String(u.phia || '').toLowerCase().includes('bắc'));
  const otherUnits = sortedParents.filter(u => !vpdhUnits.includes(u) && !ctttNamUnits.includes(u) && !ctttBacUnits.includes(u));

  return { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits };
};

// 3. Thuật toán Đệ quy vẽ nhánh cây (Sắp xếp theo chuẩn Phân nhóm và Thứ tự như bộ lọc)
export const buildHierarchicalOptions = (units: DonVi[]) => {
  const result: { unit: DonVi; prefix: string }[] = [];
  const unitIds = new Set(units.map(u => u.id));

  // Tìm các đơn vị Cấp 0 (Root)
  const rawRoots = units.filter(u => !u.cap_quan_ly || u.cap_quan_ly === 'HO' || !unitIds.has(u.cap_quan_ly));

  // Sắp xếp roots theo chuẩn phân nhóm Bộ lọc đơn vị: VPĐH -> CTTT Phía Nam -> CTTT Phía Bắc -> Khác
  const { vpdhUnits, ctttNamUnits, ctttBacUnits, otherUnits } = groupParentUnits(rawRoots);
  const roots = [...vpdhUnits, ...ctttNamUnits, ...ctttBacUnits, ...otherUnits];

  const BRANCH = '├──\xA0';
  const LAST_BRANCH = '└──\xA0';
  const VERTICAL = '│\xA0\xA0\xA0';
  const EMPTY = '\xA0\xA0\xA0\xA0';

  const visited = new Set<string>();

  const buildTree = (nodes: DonVi[], prefixStr: string) => {
    nodes.forEach((node, index) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);

      const isLast = index === nodes.length - 1;
      const nodePrefix = prefixStr ? prefixStr + (isLast ? LAST_BRANCH : BRANCH) : '';
      result.push({ unit: node, prefix: nodePrefix });

      // Sắp xếp các đơn vị con theo đúng trình tự cột thu_tu và loại bỏ node đã thăm
      const children = sortDonViByThuTu(units.filter(u => u.cap_quan_ly === node.id && !visited.has(u.id)));
      if (children.length > 0) {
        const childPrefix = prefixStr ? prefixStr + (isLast ? EMPTY : VERTICAL) : '\xA0';
        buildTree(children, childPrefix);
      }
    });
  };

  buildTree(roots, '');
  return result;
};

// 4. Hàm dùng chung đệ quy lấy toàn bộ danh sách ID đơn vị cấp dưới (có bảo vệ chống chu trình đệ quy vô hạn)
export const getAllSubordinateIds = (unitId: string, allUnits: DonVi[], visited = new Set<string>()): string[] => {
  const strId = String(unitId || '').trim();
  if (!strId || visited.has(strId)) return [];
  visited.add(strId);

  const subordinates = allUnits.filter(u => String(u.cap_quan_ly || '').trim() === strId && String(u.id || '').trim() !== strId && !visited.has(String(u.id || '').trim()));
  let ids: string[] = [];
  subordinates.forEach(sub => {
    const subId = String(sub.id || '').trim();
    if (subId && !visited.has(subId)) {
      ids.push(subId);
      ids = [...ids, ...getAllSubordinateIds(subId, allUnits, visited)];
    }
  });
  return Array.from(new Set(ids));
};

// 🟢 5. Hàm tính toán ID đơn vị mặc định dựa trên quyền và đơn vị mẹ
export const getDefaultUnitId = (user: any, donViList: DonVi[]): string | null => {
  if (!user || !donViList || donViList.length === 0) return null;

  // 1. Kiểm tra nếu tài khoản là Admin hoặc Toàn quyền
  const quyenUpper = String(user.quyen || '').toUpperCase();
  const quyenTruyCap = String(user.quyen_truy_cap || '').toUpperCase();
  const isAllAccess = quyenUpper === 'ADMIN' || quyenTruyCap.includes('ALL') || user.id_don_vi === 'ALL';

  // Tìm đơn vị THACO AUTO (root)
  const thacoAutoUnit = donViList.find(d => {
    const name = String(d.ten_don_vi || '').trim().toUpperCase();
    return name === 'THACO AUTO';
  });

  if (isAllAccess) {
    if (thacoAutoUnit) return thacoAutoUnit.id;
    // Fallback: Tìm đơn vị không có cấp quản lý (root)
    const rootUnit = donViList.find(d => !d.cap_quan_ly || d.cap_quan_ly.trim() === '' || d.cap_quan_ly === 'HO');
    if (rootUnit) return rootUnit.id;
    return donViList[0]?.id || null;
  }

  // 2. Với tài khoản thường: tìm Đơn vị mẹ quản lý
  const userIdDonVi = String(user.id_don_vi || '').trim();
  if (!userIdDonVi) return donViList[0]?.id || null;

  let current = donViList.find(d => String(d.id) === userIdDonVi);
  if (!current) return userIdDonVi;

  // Xây dựng đường dẫn ngược lên root để tìm đơn vị mẹ (cấp ngay dưới THACO AUTO hoặc không có parent)
  const path: DonVi[] = [];
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    path.push(current);
    visited.add(current.id);

    const parentId = String(current.cap_quan_ly || '').trim();
    // Nếu cha là THACO AUTO hoặc không có cha, dừng lại
    if (!parentId || parentId === 'HO' || (thacoAutoUnit && parentId === thacoAutoUnit.id)) {
      break;
    }

    const parent = donViList.find(d => String(d.id) === parentId);
    current = parent;
  }

  if (path.length > 0) {
    const candidate = path[path.length - 1];
    // Đảm bảo candidate không phải là chính THACO AUTO nếu user không phải Admin
    if (thacoAutoUnit && candidate.id === thacoAutoUnit.id && path.length > 1) {
      return path[path.length - 2].id;
    }
    return candidate.id;
  }

  return userIdDonVi;
};

// 5. Kiểm tra đơn vị có thuộc phạm vi Quản trị Chi phí hay không:
// Điều kiện: loai_hinh / phan_loai là 'Văn phòng', 'Công ty Tỉnh thành', 'VP Công ty', 'Showroom Quản trị'
export const isCostManagementUnit = (dv?: DonVi | null): boolean => {
  if (!dv) return false;
  // Kiểm tra đồng thời loai_hinh và phan_loai (phòng hờ trường dữ liệu từ Sheets/Supabase)
  const raw = `${dv.loai_hinh || ''} ${(dv as any).phan_loai || ''} ${(dv as any).don_vi_phan_loai || ''}`.trim().toLowerCase();
  if (!raw) return false;

  // 1. Văn phòng (VPĐH, Tổng công ty...)
  if (raw === 'văn phòng' || raw.includes('văn phòng') || raw === 'vpđh' || raw.includes('tổng công ty')) return true;
  // 2. VP Công ty (Văn phòng Công ty tỉnh thành)
  if (raw === 'vp công ty' || raw.includes('vp công ty') || raw.includes('văn phòng công ty')) return true;
  // 3. Công ty Tỉnh thành / CTTT
  if (raw === 'công ty tỉnh thành' || raw.includes('công ty tỉnh') || raw.includes('cttt')) return true;
  // 4. Showroom Quản trị / SRQT
  if (raw === 'showroom quản trị' || raw.includes('quản trị') || raw.includes('srqt')) return true;
  return false;
};

// 6. Truy vết đơn vị quản trị cấp cha cho một đơn vị con (Showroom con, Đại lý con...)
export const resolveCostManagementUnit = (
  unitId?: string | null,
  donViList: DonVi[] = []
): DonVi | null => {
  if (!unitId) return null;
  const donViMap = new Map<string, DonVi>(donViList.map(d => [String(d.id), d]));
  let current = donViMap.get(String(unitId));
  if (!current) return null;

  const visited = new Set<string>();
  while (current && !visited.has(String(current.id))) {
    if (isCostManagementUnit(current)) {
      return current;
    }
    visited.add(String(current.id));
    const parentId = String(current.cap_quan_ly || '').trim();
    if (!parentId || parentId === 'HO') break;
    current = donViMap.get(parentId);
  }
  return null;
};

// 7. Kiểm tra tài khoản có phải toàn quyền / Admin hay không
export const isUserAdminOrAllAccess = (user?: any): boolean => {
  if (!user) return false;
  const quyenUpper = String(user.quyen || '').toUpperCase();
  const quyenTruyCap = String(user.quyen_truy_cap || '').toUpperCase();
  const idDv = String(user.id_don_vi || (user as any).idDonVi || '').toUpperCase();
  return (
    quyenUpper === 'ADMIN' ||
    quyenUpper === 'TOÀN QUYỀN' ||
    quyenTruyCap.includes('ALL') ||
    idDv === 'ALL' ||
    idDv === 'HO' ||
    idDv === 'DV_HO'
  );
};

// 8. Lấy toàn bộ ID đơn vị thuộc phạm vi phân quyền của tài khoản:
// Đối với tài khoản cấp đơn vị: trả về Set gồm Đơn vị mẹ quản lý + tất cả các đơn vị trực thuộc (Showroom con...)
// Hỗ trợ trường hợp tài khoản được gán 2, 3, 4 đơn vị cùng lúc (phân tách bằng dấu phẩy)
// Đối với tài khoản Admin / Toàn quyền: trả về null (toàn quyền truy cập tất cả)
export const getUserPermittedUnitIds = (user: any, donViList: DonVi[]): Set<string> | null => {
  if (!user || isUserAdminOrAllAccess(user)) {
    return null;
  }

  const rawIdDonVi = String(user.id_don_vi || (user as any).idDonVi || '').trim();
  if (!rawIdDonVi) return null;

  const unitIds = rawIdDonVi.split(',').map(s => s.trim()).filter(Boolean);
  if (unitIds.length === 0) return null;
  if (unitIds.includes('ALL') || unitIds.includes('HO') || unitIds.includes('DV_HO')) return null;

  const thacoAutoUnit = donViList.find(d => String(d.ten_don_vi || '').trim().toUpperCase() === 'THACO AUTO');
  const resultSet = new Set<string>();

  for (const uid of unitIds) {
    resultSet.add(uid);
    let current = donViList.find(d => String(d.id) === uid);
    if (!current) continue;

    const visited = new Set<string>();
    let rootUnit = current;

    while (current && !visited.has(String(current.id))) {
      visited.add(String(current.id));
      const parentId = String(current.cap_quan_ly || '').trim();
      if (!parentId || parentId === 'HO' || parentId === 'DV_HO' || (thacoAutoUnit && parentId === thacoAutoUnit.id)) {
        rootUnit = current;
        break;
      }
      const parent = donViList.find(d => String(d.id) === parentId);
      if (parent) {
        current = parent;
        rootUnit = parent;
      } else {
        break;
      }
    }

    resultSet.add(String(rootUnit.id));
    const subIds = getAllSubordinateIds(rootUnit.id, donViList);
    subIds.forEach(s => resultSet.add(String(s)));
  }

  return resultSet;
};
