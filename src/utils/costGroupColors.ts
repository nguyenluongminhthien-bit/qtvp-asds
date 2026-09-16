/**
 * Bảng màu đặc trưng cho từng Nhóm chi phí
 * Đảm bảo mỗi nhóm chi phí có một nhãn màu riêng biệt, nổi bật và đồng bộ trên toàn ứng dụng.
 */

export interface GroupColorStyle {
  badge: string;      // Cho nhãn pill tag
  border: string;     // Viền ngăn cách hoặc viền card
  bgLight: string;    // Nền nhẹ
  dot: string;        // Màu chấm tròn
  text: string;       // Màu chữ chính
}

const PALETTES: GroupColorStyle[] = [
  {
    badge: 'bg-blue-50 text-[#005698] border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    border: 'border-blue-200 dark:border-blue-800',
    bgLight: 'bg-blue-50/50 dark:bg-blue-950/30',
    dot: 'bg-[#005698]',
    text: 'text-[#005698] dark:text-blue-400'
  },
  {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    border: 'border-emerald-200 dark:border-emerald-800',
    bgLight: 'bg-emerald-50/50 dark:bg-emerald-950/30',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400'
  },
  {
    badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    border: 'border-amber-200 dark:border-amber-800',
    bgLight: 'bg-amber-50/50 dark:bg-amber-950/30',
    dot: 'bg-amber-500',
    text: 'text-amber-800 dark:text-amber-400'
  },
  {
    badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    border: 'border-purple-200 dark:border-purple-800',
    bgLight: 'bg-purple-50/50 dark:bg-purple-950/30',
    dot: 'bg-purple-500',
    text: 'text-purple-700 dark:text-purple-400'
  },
  {
    badge: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
    border: 'border-cyan-200 dark:border-cyan-800',
    bgLight: 'bg-cyan-50/50 dark:bg-cyan-950/30',
    dot: 'bg-cyan-500',
    text: 'text-cyan-800 dark:text-cyan-400'
  },
  {
    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    border: 'border-rose-200 dark:border-rose-800',
    bgLight: 'bg-rose-50/50 dark:bg-rose-950/30',
    dot: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-400'
  },
  {
    badge: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
    border: 'border-orange-200 dark:border-orange-800',
    bgLight: 'bg-orange-50/50 dark:bg-orange-950/30',
    dot: 'bg-orange-500',
    text: 'text-orange-800 dark:text-orange-400'
  },
  {
    badge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
    border: 'border-teal-200 dark:border-teal-800',
    bgLight: 'bg-teal-50/50 dark:bg-teal-950/30',
    dot: 'bg-teal-500',
    text: 'text-teal-700 dark:text-teal-400'
  },
  {
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    border: 'border-indigo-200 dark:border-indigo-800',
    bgLight: 'bg-indigo-50/50 dark:bg-indigo-950/30',
    dot: 'bg-indigo-500',
    text: 'text-indigo-700 dark:text-indigo-400'
  },
  {
    badge: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800',
    border: 'border-pink-200 dark:border-pink-800',
    bgLight: 'bg-pink-50/50 dark:bg-pink-950/30',
    dot: 'bg-pink-500',
    text: 'text-pink-700 dark:text-pink-400'
  },
  {
    badge: 'bg-lime-50 text-lime-800 border-lime-200 dark:bg-lime-950/60 dark:text-lime-300 dark:border-lime-800',
    border: 'border-lime-200 dark:border-lime-800',
    bgLight: 'bg-lime-50/50 dark:bg-lime-950/30',
    dot: 'bg-lime-600',
    text: 'text-lime-800 dark:text-lime-400'
  },
  {
    badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    border: 'border-slate-300 dark:border-slate-700',
    bgLight: 'bg-slate-50 dark:bg-slate-800',
    dot: 'bg-slate-500',
    text: 'text-slate-700 dark:text-slate-300'
  }
];

// Bản đồ nhóm chi phí đã biết sang bảng màu cố định
const KNOWN_MAP: Record<string, number> = {
  'chi phí nhân sự': 0,
  'tiền lương': 0,
  'lương': 0,
  'chi phí tiếp khách': 2,
  'tiếp khách': 2,
  'chi phí hội họp': 2,
  'chi phí dịch vụ mua ngoài': 1,
  'dịch vụ mua ngoài': 1,
  'chi phí văn phòng phẩm': 3,
  'văn phòng phẩm': 3,
  'công cụ dụng cụ': 3,
  'chi phí điện nước': 4,
  'điện nước': 4,
  'viễn thông': 4,
  'chi phí khấu hao': 5,
  'khấu hao': 5,
  'chi phí tiếp thị': 6,
  'marketing': 6,
  'quảng cáo': 6,
  'chi phí sửa chữa': 7,
  'bảo trì': 7,
  'chi phí xăng xe': 8,
  'nhiên liệu': 8,
  'chi phí thuê ngoài': 9,
  'chi phí khác': 11
};

/**
 * Lấy style màu đại diện cho một nhóm chi phí
 */
export function getCostGroupStyle(groupName?: string | null): GroupColorStyle {
  if (!groupName || !groupName.trim()) {
    return PALETTES[PALETTES.length - 1];
  }

  const clean = groupName.trim().toLowerCase();
  
  // Kiểm tra tên nhóm đã biết
  for (const [key, idx] of Object.entries(KNOWN_MAP)) {
    if (clean.includes(key)) {
      return PALETTES[idx % PALETTES.length];
    }
  }

  // Nếu chưa có trong bảng biết trước, tính mã hash ổn định
  let hash = 0;
  for (let i = 0; i < groupName.length; i++) {
    hash = (hash << 5) - hash + groupName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}
