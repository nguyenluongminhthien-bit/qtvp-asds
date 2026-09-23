import React, { useMemo } from "react";
import { Car, BarChart3, Receipt, ShieldCheck, AlertTriangle, TrendingUp, Wrench } from "lucide-react";
import { TS_Xe, DonVi } from "../../types";
import { formatCurrencySpace as formatCurrency } from "../../utils/formatters";
import VehiclePivotView from "./pivot/VehiclePivotView";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const getCostCarId = (cp: any) => cp.id_ts_xe || cp.id_phuong_tien || "";

const calcTotalCost = (costs: any[]) =>
  costs.reduce(
    (sum, c) =>
      sum +
      (Number(c.cp_nhien_lieu) || 0) +
      (Number(c.cp_cau_duong_ben_bai) || 0) +
      (Number(c.cp_rua_xe) || 0) +
      (Number(c.cp_bao_duong_sua_chua) || 0) +
      (Number(c.cp_thue_khau_hao) || 0) +
      (Number(c.cp_dang_kiem) || 0) +
      (Number(c.cp_bh_tnds) || 0) +
      (Number(c.cp_bh_vc) || 0),
    0
  );

const PURPOSE_COLORS: Record<string, string> = {
  "Xe công": "#3b82f6",
  "Xe lái thử": "#8b5cf6",
  "Xe Chuyên dụng": "#10b981",
  "Xe cho thuê": "#06b6d4",
  "Xe thay thế cho KH": "#f59e0b",
  "Xe sửa chữa lưu động": "#f97316",
  "Xe SCLĐ": "#f97316",
};
const getPurposeColor = (p: string) =>
  PURPOSE_COLORS[p] || "#9ca3af";

const STATUS_COLORS: Record<string, string> = {
  "Đang hoạt động": "#10b981",
  "Sửa chữa": "#f59e0b",
  "Ngưng hoạt động": "#ef4444",
  "Đã Thanh lý": "#9ca3af",
  "Chuyển KD xe QSD": "#6366f1",
};
const getStatusColor = (s: string) =>
  STATUS_COLORS[s] || "#9ca3af";

const getBrandColor = (brandStr: string = '') => {
  const b = brandStr.trim().toLowerCase();
  if (!b) return '#9ca3af';
  if (b.includes('bmw')) return '#0284c7';
  if (b.includes('peugeot')) return '#7c3aed';
  if (b.includes('mazda')) return '#e11d48';
  if (b.includes('kia')) return '#d97706';
  if (b.includes('toyota')) return '#059669';
  if (b.includes('ford')) return '#2563eb';
  if (b.includes('fuso')) return '#0d9488';
  if (b.includes('mercedes') || b.includes('merc')) return '#475569';
  if (b.includes('hyundai')) return '#0891b2';
  if (b.includes('honda')) return '#dc2626';
  if (b.includes('lexus')) return '#9333ea';
  if (b.includes('mitsubishi')) return '#db2777';
  if (b.includes('thaco') || b.includes('truck')) return '#4f46e5';
  if (b.includes('vinfast')) return '#c084fc';
  if (b.includes('nissan')) return '#ea580c';
  if (b.includes('isuzu')) return '#65a30d';
  if (b.includes('hino')) return '#ca8a04';
  return '#3b82f6';
};

// Tái xuất khẩu cấu hình thương hiệu tập trung từ vehicleBrandConfig
export {
  getBrandBadgeStyle,
  getBrandEmoji,
  renderBrandBadge,
  getBrandConfig,
  VEHICLE_BRANDS
} from '../../constants/vehicleBrandConfig';

const fmtMonth = (s: string) => {
  if (!s) return "";
  const [y, m] = s.split("-");
  return `T${m}/${y?.slice(2)}`;
};

// ─── PROPS ───────────────────────────────────────────────────────────────────
interface Props {
  filteredCars: (TS_Xe & any)[];
  chiPhiData: any[];
  donViMap: Record<string, string>;
  donViList?: DonVi[];
  onViewCar: (car: TS_Xe & any) => void;
  nhatKyData: any[];
  subTab?: 'pivot' | 'dashboard';
}

// ─── LEGAL CARD COLOR ────────────────────────────────────────────────────────
const legalCardCls = (s: { expired: number; warning: number }) => {
  if (s.expired > 0) return "bg-red-50 border-red-200";
  if (s.warning > 0) return "bg-yellow-50 border-yellow-200";
  return "bg-emerald-50 border-emerald-200";
};

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function VehicleStatsTab({
  filteredCars,
  chiPhiData,
  donViMap,
  donViList = [],
  onViewCar,
  nhatKyData,
  subTab = 'pivot'
}: Props) {
  // Nếu chọn subTab là pivot, hiển thị Báo cáo Thống kê Đa chiều
  if (subTab === 'pivot') {
    return (
      <VehiclePivotView
        cars={filteredCars}
        donViList={donViList}
        donViMap={donViMap}
        nhatKyData={nhatKyData}
        chiPhiData={chiPhiData}
      />
    );
  }

  // Alias danh sách xe
  const cars = filteredCars;

  // Chi phi lien quan
  const relevantCosts = useMemo(() => {
    const ids = new Set(filteredCars.map((x) => x.id));
    return chiPhiData.filter((cp) => ids.has(getCostCarId(cp)));
  }, [filteredCars, chiPhiData]);

  // KPI
  const kpi = useMemo(() => {
    const total = filteredCars.length;
    const active = filteredCars.filter((x) => x.hien_trang === "Đang hoạt động").length;
    const totalCost = calcTotalCost(relevantCosts);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let expiring = 0;
    filteredCars.forEach((xe) => {
      ["han_dang_kiem", "han_bh_tnds", "han_bh_vc"].forEach((field) => {
        if (!xe[field]) return;
        const d = new Date(xe[field]); d.setHours(0, 0, 0, 0);
        if ((d.getTime() - today.getTime()) / 86400000 <= 30) expiring++;
      });
    });
    return { total, active, expiring, totalCost };
  }, [filteredCars, relevantCosts]);

  // Hang xe
  const brandStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCars.forEach((x) => { const b = x.hieu_xe || "Khac"; map[b] = (map[b] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredCars]);

  // Muc dich
  const purposeStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCars.forEach((x) => { const p = x.muc_dich_su_dung || "Khac"; map[p] = (map[p] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredCars]);

  // Hien trang
  const statusStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCars.forEach((x) => { const s = x.hien_trang || "Khác"; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredCars]);

  // Nam SX oldest/newest va helper getYearColor
  const oldestYear = useMemo(() => {
    const years = filteredCars.map(x => Number(x.nam_sx)).filter(y => y && !isNaN(y));
    return years.length > 0 ? Math.min(...years) : 2010;
  }, [filteredCars]);

  const newestYear = useMemo(() => {
    const years = filteredCars.map(x => Number(x.nam_sx)).filter(y => y && !isNaN(y));
    return years.length > 0 ? Math.max(...years) : new Date().getFullYear();
  }, [filteredCars]);

  const getYearColor = (yearStr: string) => {
    const y = Number(yearStr);
    if (!y || isNaN(y)) return '#9ca3af';
    if (newestYear === oldestYear) return '#005698';
    const ratio = (y - oldestYear) / (newestYear - oldestYear);
    const r = Math.round(234 - (234 - 0) * ratio);
    const g = Math.round(88 + (86 - 88) * ratio);
    const b = Math.round(12 + (152 - 12) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const yearStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCars.forEach((x) => { const y = String(x.nam_sx || "Chưa rõ"); map[y] = (map[y] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredCars]);

  // Bieu do chi phi thang
  const monthlyChart = useMemo(() => {
    const byMonth: Record<string, { nl: number; bd: number; cd: number; rx: number; khac: number }> = {};
    relevantCosts.forEach((c) => {
      const m = c.thang_nam || ""; if (!m) return;
      if (!byMonth[m]) byMonth[m] = { nl: 0, bd: 0, cd: 0, rx: 0, khac: 0 };
      byMonth[m].nl += Number(c.cp_nhien_lieu) || 0;
      byMonth[m].bd += Number(c.cp_bao_duong_sua_chua) || 0;
      byMonth[m].cd += Number(c.cp_cau_duong_ben_bai) || 0;
      byMonth[m].rx += Number(c.cp_rua_xe) || 0;
      byMonth[m].khac += (Number(c.cp_thue_khau_hao) || 0) + (Number(c.cp_dang_kiem) || 0) + (Number(c.cp_bh_tnds) || 0) + (Number(c.cp_bh_vc) || 0);
    });
    const months = Object.keys(byMonth).sort().slice(-12);
    const rows = months.map((m) => ({ m, ...byMonth[m], total: byMonth[m].nl + byMonth[m].bd + byMonth[m].cd + byMonth[m].rx + byMonth[m].khac }));
    const maxTotal = Math.max(...rows.map((r) => r.total), 1);
    return { rows, maxTotal };
  }, [relevantCosts]);

  // Top 10 xe di chuyển nhiều nhất theo Km
  const top10 = useMemo(() =>
    filteredCars.map((car) => {
      const logs = nhatKyData.filter((log) => log.bien_so === car.bien_so);
      const total = logs.reduce((sum, log) => sum + (Number(log.tong_km) || 0), 0);
      const trips = logs.length;
      return { car, total, trips, avg: trips > 0 ? total / trips : 0 };
    }).sort((a, b) => b.total - a.total).slice(0, 10),
    [filteredCars, nhatKyData]
  );

  // Phap ly
  const legalStats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const check = (field: string) =>
      filteredCars.reduce((acc, xe) => {
        if (!xe[field]) return acc;
        const d = new Date(xe[field]); d.setHours(0, 0, 0, 0);
        const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
        if (diff < 0) acc.expired++; else if (diff <= 30) acc.warning++; else acc.ok++;
        return acc;
      }, { expired: 0, warning: 0, ok: 0 });
    return { dk: check("han_dang_kiem"), tnds: check("han_bh_tnds"), vc: check("han_bh_vc") };
  }, [filteredCars]);

  // Donut slices
  const totalForDonut = purposeStats.reduce((s, [, v]) => s + v, 0) || 1;
  const donutSlices = useMemo(() => {
    let offset = 0;
    return purposeStats.map(([label, count]) => {
      const pct = count / totalForDonut;
      const dash = pct * 251.2;
      const slice = { label, count, pct, dash, offset };
      offset += dash;
      return slice;
    });
  }, [purposeStats, totalForDonut]);

  // Status Donut slices
  const totalForStatusDonut = statusStats.reduce((s, [, v]) => s + v, 0) || 1;
  const statusDonutSlices = useMemo(() => {
    let offset = 0;
    return statusStats.map(([label, count]) => {
      const pct = count / totalForStatusDonut;
      const dash = pct * 251.2;
      const slice = { label, count, pct, dash, offset };
      offset += dash;
      return slice;
    });
  }, [statusStats, totalForStatusDonut]);

  const maxBrand = brandStats[0]?.[1] || 1;
  const maxYear = yearStats[0]?.[1] || 1;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-6 pb-6">

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "TỔNG XE", value: kpi.total, sub: "Phương tiện", icon: <Car size={24} />, color: "text-gray-800", bg: "border-blue-200 hover:border-[#005698]", iconBg: "bg-blue-100 text-[#005698] border-blue-200" },
          { label: "ĐANG HOẠT ĐỘNG", value: kpi.active, sub: `${kpi.total > 0 ? ((kpi.active / kpi.total) * 100).toFixed(1) : 0}%`, icon: <TrendingUp size={24} />, color: "text-emerald-600", bg: "border-emerald-200 hover:border-emerald-500", iconBg: "bg-emerald-100 text-emerald-600 border-emerald-250" },
          { label: "SẮP / ĐÃ HẾT HẠN", value: kpi.expiring, sub: "Hạng mục ĐK & BH", icon: <AlertTriangle size={24} />, color: kpi.expiring > 0 ? "text-red-600" : "text-gray-500", bg: kpi.expiring > 0 ? "border-red-200 hover:border-red-500" : "border-gray-200 hover:border-gray-400", iconBg: kpi.expiring > 0 ? "bg-red-100 text-red-500 border-red-200" : "bg-gray-100 text-gray-400 border-gray-200" },
          { label: "TỔNG CHI PHÍ", value: formatCurrency(kpi.totalCost), sub: "Tất cả các tháng (VNĐ)", icon: <Receipt size={24} />, color: "text-rose-700", bg: "border-rose-200 hover:border-rose-500", iconBg: "bg-rose-100 text-rose-500 border-rose-200" },
        ].map((card, i) => (
          <div key={i} className={`bg-white p-5 rounded-xl border ${card.bg} shadow-sm flex items-center gap-4 transition-all hover:shadow-md`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${card.iconBg}`}>
              {card.icon}
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">{card.label}</p>
              <p className={`text-3xl font-black ${card.color} leading-none`}>{card.value}</p>
              <p className="text-[10.5px] text-gray-400 font-semibold mt-1.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* HANG / MUC DICH / HIEN TRANG / NAM SX */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
            <Car size={16} className="text-[#05469B]" /> Phân loại Hãng xe
          </h4>
          {brandStats.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">Chưa có dữ liệu</p> : (
            <div className="space-y-3">
              {brandStats.slice(0, 8).map(([brand, count]) => {
                const pct = filteredCars.length > 0 ? Math.round((count / filteredCars.length) * 100) : 0;
                const barColor = getBrandColor(brand);
                return (
                  <div key={brand} className="group">
                    <div className="flex justify-between items-center mb-1.5">
                      {renderBrandBadge(brand, 'px-2 py-0.5 rounded-md text-[11px] font-bold shadow-xs max-w-[160px]')}
                      <div className="text-right">
                        <span className="text-[11.5px] font-black text-gray-800">{count} xe</span>
                        <span className="text-[10px] text-gray-400 font-medium ml-1">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                        style={{ width: `${(count / maxBrand) * 100}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm"><BarChart3 size={16} className="text-indigo-500" /> Mục đích sử dụng</h4>
          {purposeStats.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">Chua co du lieu</p> : (
            <div className="flex items-center gap-4 flex-1">
              <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0 -rotate-90">
                {donutSlices.map((s, i) => (
                  <circle key={i} cx="50" cy="50" r="40" fill="none"
                    stroke={getPurposeColor(s.label)} strokeWidth="18"
                    strokeDasharray={`${s.dash} ${251.2 - s.dash}`}
                    strokeDashoffset={-s.offset}
                  />
                ))}
                <circle cx="50" cy="50" r="31" fill="white" />
              </svg>
              <div className="space-y-2 flex-1 min-w-0">
                {donutSlices.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getPurposeColor(s.label) }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-gray-600 truncate">{s.label}</p>
                      <p className="text-[10px] text-gray-400">{s.count} xe - {(s.pct * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm"><BarChart3 size={16} className="text-emerald-500" /> Hiện trạng xe</h4>
          {statusStats.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">Chưa có dữ liệu</p> : (
            <div className="flex items-center gap-4 flex-1">
              <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0 -rotate-90">
                {statusDonutSlices.map((s, i) => (
                  <circle key={i} cx="50" cy="50" r="40" fill="none"
                    stroke={getStatusColor(s.label)} strokeWidth="18"
                    strokeDasharray={`${s.dash} ${251.2 - s.dash}`}
                    strokeDashoffset={-s.offset}
                  />
                ))}
                <circle cx="50" cy="50" r="31" fill="white" />
              </svg>
              <div className="space-y-2 flex-1 min-w-0">
                {statusDonutSlices.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getStatusColor(s.label) }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-gray-600 truncate">{s.label}</p>
                      <p className="text-[10px] text-gray-400">{s.count} xe - {(s.pct * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm"><Wrench size={16} className="text-amber-500" /> Phân loại năm Sản xuất</h4>
          {yearStats.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">Chưa có dữ liệu</p> : (
            <div className="space-y-2.5">
              {yearStats.slice(0, 8).map(([year, count]) => (
                <div key={year}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[12px] font-bold text-gray-700">{year}</span>
                    <span className="text-[11px] font-black text-amber-600">{count} xe</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / maxYear) * 100}%`, backgroundColor: getYearColor(year) }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* BIEU DO CHI PHI THANG */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h4 className="font-bold text-gray-800 mb-1 flex items-center gap-2 text-sm"><BarChart3 size={16} className="text-[#05469B]" /> CHI PHÍ HOẠT ĐỘNG THEO THÁNG</h4>
        <p className="text-[11px] text-gray-400 mb-4">Tối đã 12 tháng gần nhất</p>
        <div className="flex flex-wrap gap-3 mb-4 text-[10px] font-bold uppercase">
          {[["#3b82f6", "Nhiên liệu"], ["#ef4444", "Bảo dưỡng"], ["#f59e0b", "Cầu đường"], ["#06b6d4", "Rửa xe"], ["#9ca3af", "ĐK-BH-KH"]].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: c }} />{l}</div>
          ))}
        </div>
        {monthlyChart.rows.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <div className="text-center"><Receipt className="mx-auto mb-2 opacity-40" size={28} /><p className="text-sm">Chưa có dữ liệu chi phí</p></div>
          </div>
        ) : (
          <div className="flex gap-1 items-end h-44 overflow-x-auto pb-1">
            {monthlyChart.rows.map((r, i) => {
              const h = (v: number) => monthlyChart.maxTotal > 0 ? (v / monthlyChart.maxTotal) * 100 : 0;
              const totalH = Math.max(h(r.total), r.total > 0 ? 2 : 0);
              return (
                <div key={i} className="flex-1 min-w-[32px] flex flex-col items-center justify-end group relative h-full">
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white p-2 rounded-lg text-[10px] z-50 shadow-xl whitespace-nowrap min-w-[140px] pointer-events-none">
                    <p className="font-bold border-b border-gray-700 pb-1 mb-1">{fmtMonth(r.m)}</p>
                    {r.nl > 0 && <p>Nhien lieu: {formatCurrency(r.nl)}d</p>}
                    {r.bd > 0 && <p>Bao duong: {formatCurrency(r.bd)}d</p>}
                    {r.cd > 0 && <p>Cau duong: {formatCurrency(r.cd)}d</p>}
                    {r.rx > 0 && <p>Rua xe: {formatCurrency(r.rx)}d</p>}
                    {r.khac > 0 && <p>DK-BH-KH: {formatCurrency(r.khac)}d</p>}
                    <p className="font-bold border-t border-gray-700 pt-1 mt-1">Tong: {formatCurrency(r.total)}d</p>
                  </div>
                  <div style={{ height: `${totalH}%` }} className="w-full flex flex-col justify-end cursor-pointer opacity-85 group-hover:opacity-100 transition-opacity max-w-[36px]">
                    {r.khac > 0 && <div style={{ height: `${totalH > 0 ? h(r.khac) / totalH * 100 : 0}%` }} className="w-full bg-gray-400 rounded-t-sm" />}
                    {r.rx > 0 && <div style={{ height: `${totalH > 0 ? h(r.rx) / totalH * 100 : 0}%` }} className="w-full bg-cyan-500" />}
                    {r.cd > 0 && <div style={{ height: `${totalH > 0 ? h(r.cd) / totalH * 100 : 0}%` }} className="w-full bg-amber-400" />}
                    {r.bd > 0 && <div style={{ height: `${totalH > 0 ? h(r.bd) / totalH * 100 : 0}%` }} className="w-full bg-red-500" />}
                    {r.nl > 0 && <div style={{ height: `${totalH > 0 ? h(r.nl) / totalH * 100 : 0}%` }} className="w-full bg-blue-500 rounded-b-sm" />}
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 font-medium whitespace-nowrap">{fmtMonth(r.m)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TOP 10 XE DI CHUYỂN NHIỀU NHẤT */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-500" />
          <h4 className="font-bold text-gray-800 text-sm">TOP 10 XE CÓ TỔNG SỐ KM DI CHUYỂN NHIỀU NHẤT</h4>
        </div>
        {top10.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Chưa có dữ liệu hành trình</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-gray-50 text-[11px] text-gray-500 font-bold uppercase">
                <tr>
                  <th className="py-2.5 px-4 w-8">#</th>
                  <th className="py-2.5 px-4">Bien so</th>
                  <th className="py-2.5 px-4">Hang - Loai xe</th>
                  <th className="py-2.5 px-4 hidden md:table-cell">Don vi</th>
                  <th className="py-2.5 px-4 text-right">Tong Km</th>
                  <th className="py-2.5 px-4 text-right hidden sm:table-cell">Luot di</th>
                  <th className="py-2.5 px-4 text-right hidden md:table-cell">TB/luot</th>
                  <th className="py-2.5 px-2 w-14"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {top10.map(({ car, total, trips, avg }, i) => (
                  <tr key={car.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-gray-400">{i + 1}</td>
                    <td className="py-2.5 px-4 font-black text-[#05469B] whitespace-nowrap">{car.bien_so}</td>
                    <td className="py-2.5 px-4">
                      {renderBrandBadge(car.hieu_xe, 'px-2 py-0.5 rounded-md text-[11px] font-bold shadow-xs')}
                      <p className="text-[11px] text-gray-400 mt-0.5">{car.loai_xe || ""}</p>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 hidden md:table-cell truncate max-w-[160px]">{donViMap[car.id_don_vi] || car.id_don_vi}</td>
                    <td className="py-2.5 px-4 text-right font-black text-emerald-600 whitespace-nowrap">{formatCurrency(total)} km</td>
                    <td className="py-2.5 px-4 text-right text-gray-600 hidden sm:table-cell">{trips}</td>
                    <td className="py-2.5 px-4 text-right text-gray-500 hidden md:table-cell">{avg.toFixed(1)} km</td>
                    <td className="py-2.5 px-2 text-center">
                      <button onClick={() => onViewCar(car)} className="px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 rounded text-[10px] font-bold transition-colors">Xem</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TRANG THAI PHAP LY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Han Dang kiem", stats: legalStats.dk },
          { label: "Bao hiem TNDS", stats: legalStats.tnds },
          { label: "Bao hiem Vat chat", stats: legalStats.vc },
        ].map(({ label, stats }) => (
          <div key={label} className={`border rounded-xl p-4 ${legalCardCls(stats)}`}>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={18} className={stats.expired > 0 ? "text-red-500" : stats.warning > 0 ? "text-yellow-500" : "text-emerald-500"} />
              <h5 className="font-bold text-gray-800 text-sm">{label}</h5>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xl font-black text-red-600">{stats.expired}</p><p className="text-[10px] text-gray-500 font-medium">Qua han</p></div>
              <div><p className="text-xl font-black text-yellow-600">{stats.warning}</p><p className="text-[10px] text-gray-500 font-medium">&lt; 30 ngay</p></div>
              <div><p className="text-xl font-black text-emerald-600">{stats.ok}</p><p className="text-[10px] text-gray-500 font-medium">Con han</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
