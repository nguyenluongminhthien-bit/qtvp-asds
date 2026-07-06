import { DonVi } from '../types';

// 1. Hàm tự động cấp Icon (Emoji) dùng cho các danh sách xổ xuống (Select)
export const getUnitEmoji = (loai_hinh?: string) => {
  // Dùng .trim() để xóa khoảng trắng thừa từ Google Sheets
  const lower = String(loai_hinh || '').toLowerCase().trim();
  if (lower.includes('tổng công ty')) return '🏢';
  if (lower.includes('công ty tỉnh')) return '🏪';
  if (lower.includes('quản trị')) return '🏪';
  if (lower.includes('showroom')) return '🏬';
  if (lower.includes('điểm kinh doanh')) return '📍';
  if (lower.includes('kho')) return '🏭';
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

  const buildTree = (nodes: DonVi[], prefixStr: string) => {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1;
      const nodePrefix = prefixStr ? prefixStr + (isLast ? LAST_BRANCH : BRANCH) : '';
      result.push({ unit: node, prefix: nodePrefix });
      
      // Sắp xếp các đơn vị con theo đúng trình tự cột thu_tu
      const children = sortDonViByThuTu(units.filter(u => u.cap_quan_ly === node.id));
      if (children.length > 0) {
        const childPrefix = prefixStr ? prefixStr + (isLast ? EMPTY : VERTICAL) : '\xA0';
        buildTree(children, childPrefix);
      }
    });
  };

  buildTree(roots, '');
  return result;
};