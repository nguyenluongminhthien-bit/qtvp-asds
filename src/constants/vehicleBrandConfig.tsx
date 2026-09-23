'File cài đặt Thương hiệu xe và icon thương hiệu; với các lựa chọn là png trong folder Public/vehicle'
'1. Kích thước mặc định của Icon Logo khi gọi getBrandEmoji - Tại dòng 184, tham số imgClass quy định kích thước mặc định cho các ảnh logo thương hiệu'
'2. Kích thước Icon bên trong Badge thương hiệu(renderBrandBadge) - Tại dòng 202, hàm renderBrandBadge gọi getBrandEmoji với class kích thước riêng dành cho badge'

import React from 'react';

export interface VehicleBrandItem {
  key: string;
  name: string;
  logo?: string;
  emoji?: string;
  badgeStyle: string;
  models: string[];
}

export const VEHICLE_BRANDS: VehicleBrandItem[] = [
  {
    key: 'THACO',
    name: 'THACO',
    // TUYỆT ĐỐI KHÔNG DÙNG LOGO ẢNH CHO THACO THEO QUY ĐỊNH BẢN QUYỀN
    emoji: '🚛',
    badgeStyle: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    models: [
      'Ollin 198', 'Ollin 350', 'Ollin 500', 'Ollin 700', 'Ollin 720',
      'Towner 800', 'Towner Van', 'Frontier 125', 'Frontier 990',
      'Frontier K200', 'Frontier K250', 'TL700', 'Bus 29 chỗ',
      'Aumark 500', 'IVECO'
    ]
  },
  {
    key: 'KIA',
    name: 'KIA',
    logo: 'Logo/kia-logo.png',
    badgeStyle: 'bg-amber-50 text-amber-700 border border-amber-200',
    models: [
      'Morning', 'Soluto', 'Sonet', 'Seltos', 'Sedona', 'Sportage',
      'Carnival', 'Sorento', 'Telluride', 'K3', 'K5', 'EV6', 'EV9',
      'Stonic', 'Carens', 'K190', 'K3000'
    ]
  },
  {
    key: 'MAZDA',
    name: 'MAZDA',
    logo: 'Logo/mazda-logo.png',
    badgeStyle: 'bg-rose-50 text-rose-700 border border-rose-200',
    models: [
      'Mazda2', 'Mazda3', 'Mazda6', 'CX-3', 'CX-30', 'CX-5', 'CX-8',
      'CX-60', 'CX-90', 'MX-5', 'BT-50'
    ]
  },
  {
    key: 'PEUGEOT',
    name: 'PEUGEOT',
    logo: 'Logo/peugeot-logo.png',
    badgeStyle: 'bg-violet-50 text-violet-700 border border-violet-200',
    models: [
      '208', '2008', '3008', '5008', '408', '508', '508 SW',
      'Django', 'Rifter', 'Partner', 'Expert', 'Traveller', 'Boxer'
    ]
  },
  {
    key: 'BMW MOTORRAD',
    name: 'BMW MOTORRAD',
    logo: 'Logo/bmw-logo.png',
    badgeStyle: 'bg-sky-50 text-sky-700 border border-sky-200',
    models: [
      'R1250GS', 'R1250R', 'R1250RT', 'S1000RR', 'S1000R', 'F900R',
      'F900XR', 'G310R', 'G310GS', 'R18', 'M1000RR', 'C400'
    ]
  },
  {
    key: 'BMW',
    name: 'BMW',
    logo: 'Logo/bmw-logo.png',
    badgeStyle: 'bg-sky-50 text-sky-700 border border-sky-200',
    models: [
      '118i', '218i', '320i', '330i', '430i', '520i', '530i', '730Li',
      '740Li', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'M2', 'M3',
      'M4', 'M5', 'iX3', 'i4'
    ]
  },
  {
    key: 'MINI',
    name: 'MINI',
    logo: 'Logo/mini-logo.png',
    badgeStyle: 'bg-slate-100 text-slate-800 border border-slate-300',
    models: ['Cooper', 'Countryman', 'Clubman', 'One']
  },
  {
    key: 'JEEP',
    name: 'JEEP',
    logo: 'Logo/jeep-logo.png',
    badgeStyle: 'bg-orange-50 text-orange-700 border border-orange-200',
    models: [
      'Wrangler', 'Wrangler Unlimited', 'Gladiator', 'Grand Cherokee',
      'Grand Cherokee L', 'Compass', 'Renegade', 'Commander'
    ]
  },
  {
    key: 'RAM',
    name: 'RAM',
    logo: 'Logo/ram-logo.png',
    badgeStyle: 'bg-red-50 text-red-700 border border-red-200',
    models: ['1500', '2500', '3500', 'ProMaster']
  },
  {
    key: 'FUSO',
    name: 'FUSO',
    emoji: '🚚',
    badgeStyle: 'bg-teal-50 text-teal-700 border border-teal-200',
    models: [
      'Canter 1.9T', 'Canter 3.5T', 'Canter 5T', 'Canter 6.5T',
      'Canter 7T', 'Fighter', 'Super Great', 'Rosa 16 chỗ', 'Rosa 29 chỗ'
    ]
  },
  {
    key: 'MITSUBISHI',
    name: 'Mitsubishi',
    logo: 'Logo/mitsubishi-logo.png',
    badgeStyle: 'bg-pink-50 text-pink-700 border border-pink-200',
    models: ['Xe nâng điện', 'Xe nâng dầu']
  },
  {
    key: 'TCM',
    name: 'TCM',
    emoji: '🚜',
    badgeStyle: 'bg-amber-100 text-amber-900 border border-amber-300',
    models: ['Xe nâng điện', 'Xe nâng dầu']
  }
];

// ─── RECORD DÙNG CHUNG CHO DROPDOWN MODEL ─────────────────────────────────────
export const VEHICLE_MODELS: Record<string, string[]> = VEHICLE_BRANDS.reduce((acc, curr) => {
  acc[curr.name] = curr.models;
  return acc;
}, {} as Record<string, string[]>);

// ─── TÌM CẤU HÌNH THƯƠNG HIỆU THEO CHUỖI ─────────────────────────────────────
export const getBrandConfig = (brandStr: string = ''): VehicleBrandItem | null => {
  if (!brandStr) return null;
  const b = brandStr.trim().toLowerCase();

  // Ưu tiên kiểm tra chuỗi đặc biệt trước
  if (b.includes('bmw motorrad')) {
    return VEHICLE_BRANDS.find(v => v.key === 'BMW MOTORRAD') || null;
  }
  if (b.includes('thaco') || b.includes('ollin') || b.includes('towner') || b.includes('frontier')) {
    return VEHICLE_BRANDS.find(v => v.key === 'THACO') || null;
  }
  if (b.includes('mitsubishi') || b.includes('tcm')) {
    if (b.includes('tcm')) return VEHICLE_BRANDS.find(v => v.key === 'TCM') || null;
    return VEHICLE_BRANDS.find(v => v.key === 'MITSUBISHI') || null;
  }

  for (const item of VEHICLE_BRANDS) {
    if (b.includes(item.key.toLowerCase()) || b.includes(item.name.toLowerCase())) {
      return item;
    }
  }

  return null;
};

// ─── LẤY STYLE MÀU NHÃN HÃNG XE ──────────────────────────────────────────────
export const getBrandBadgeStyle = (brandStr: string = ''): string => {
  const cfg = getBrandConfig(brandStr);
  if (cfg) return cfg.badgeStyle;

  const b = brandStr.trim().toLowerCase();
  if (!b) return 'bg-gray-100 text-gray-700 border border-gray-200';

  // Fallback palettes
  const palettes = [
    'bg-teal-100 text-teal-800 border border-teal-300',
    'bg-indigo-100 text-indigo-800 border border-indigo-300',
    'bg-rose-100 text-rose-800 border border-rose-300',
    'bg-cyan-100 text-cyan-800 border border-cyan-300',
    'bg-purple-100 text-purple-800 border border-purple-300',
    'bg-orange-100 text-orange-800 border border-orange-300'
  ];
  let hash = 0;
  for (let i = 0; i < b.length; i++) hash = b.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
};

// ─── LẤY ICON LOGO PNG HOẶC EMOJI ─────────────────────────────────────────────
export const getBrandEmoji = (brandStr: string = '', imgClass: string = 'w-5 h-5 object-contain inline-block') => {
  const cfg = getBrandConfig(brandStr);
  if (cfg) {
    if (cfg.logo) {
      return <img src={cfg.logo} alt={cfg.name} className={imgClass} />;
    }
    return cfg.emoji || '🚗';
  }
  return '🚗';
};

// ─── RENDER NGUYÊN BỘ BADGE MÀU KÈM LOGO PNG ──────────────────────────────────
export const renderBrandBadge = (
  brandStr: string = '',
  customClasses: string = 'px-1.5 py-0.5 rounded text-[10px] font-bold shadow-2xs'
) => {
  const brandName = brandStr.trim() || 'Khác';
  const badgeStyle = getBrandBadgeStyle(brandStr);
  const icon = getBrandEmoji(brandStr, 'w-3.5 h-3.5 object-contain inline-block');

  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 ${badgeStyle} ${customClasses}`}
      title={`Hãng: ${brandName}`}
    >
      <span className="shrink-0 inline-flex items-center justify-center leading-none">
        {icon}
      </span>
      <span className="truncate">{brandName}</span>
    </span>
  );
};
