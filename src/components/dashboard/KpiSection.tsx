import React from 'react';
import { Building2, Users } from 'lucide-react';

interface KpiSectionProps {
  vpdhUnits: any[];
  ctttNamUnits: any[];
  ctttBacUnits: any[];
  widgetStats: {
    totalUnits: number;
    totalStaff: number;
  };
  staffRolesStats: {
    dvht: number;
    bv: number;
    pvhc: number;
  };
}

export default function KpiSection({
  vpdhUnits,
  ctttNamUnits,
  ctttBacUnits,
  widgetStats,
  staffRolesStats,
}: KpiSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      {/* Card 1: Phân hệ */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Building2 size={14} className="text-[#05469B]" />Bộ máy Quản trị</p>
        <div className="flex items-center justify-between px-2">
          <div className="text-center">
            <p className="text-2xl font-black text-[#05469B]">{vpdhUnits.length}</p>
            <p className="text-[10px] font-bold text-gray-400">VPĐH</p>
          </div>
          <div className="w-px h-8 bg-gray-100"></div>
          <div className="text-center">
            <p className="text-2xl font-black text-orange-500">{ctttNamUnits.length}</p>
            <p className="text-[10px] font-bold text-gray-400">PHÍA NAM</p>
          </div>
          <div className="w-px h-8 bg-gray-100"></div>
          <div className="text-center">
            <p className="text-2xl font-black text-emerald-600">{ctttBacUnits.length}</p>
            <p className="text-[10px] font-bold text-gray-400">PHÍA BẮC</p>
          </div>
        </div>
      </div>
      
      {/* Card 2: Showroom/Đại lý trực thuộc */}
      <div className="bg-gradient-to-br from-indigo-50/50 to-white p-5 rounded-2xl border border-indigo-100/50 shadow-sm flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100/30 flex items-center justify-center text-[#05469B] shrink-0 shadow-inner"><Building2 size={26}/></div>
        <div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">Showroom / Trực thuộc</p>
          <p className="text-3xl font-black text-gray-800">{widgetStats.totalUnits}</p>
        </div>
        <div className="absolute -right-6 -bottom-6 opacity-[0.04] text-[#05469B] pointer-events-none"><Building2 size={120}/></div>
      </div>

      {/* Card 3 & 4: Tổng Nhân sự và nghiệp vụ */}
      <div className="xl:col-span-2 bg-gradient-to-br from-emerald-50/50 to-white p-5 rounded-2xl border border-emerald-100/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between relative overflow-hidden gap-4 h-full">
        
        {/* Tổng số lượng bên trái */}
        <div className="flex items-center gap-4.5 shrink-0 z-10 pl-2 border-r border-gray-100/80 pr-4 sm:pr-8 h-full">
          <div className="w-13 h-13 rounded-2xl bg-emerald-50 border border-emerald-100/30 flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">Tổng Nhân sự</p>
            <p className="text-3xl font-black text-gray-800 leading-none">{widgetStats.totalStaff}</p>
          </div>
        </div>
        
        {/* Cơ cấu nghiệp vụ bên phải */}
        <div className="flex-1 grid grid-cols-3 gap-3 z-10 h-full py-1">
          <div className="bg-white/80 rounded-2xl p-2 text-center border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition-all flex flex-col justify-between h-full cursor-help" title="Nhân sự Phụ trách Quản trị văn phòng & An sinh đời sống">
            <div className="h-7 flex items-center justify-center mb-1">
              <p className="text-[9px] font-black text-slate-500 uppercase leading-snug line-clamp-2">NS PT QTVP & ASĐS</p>
            </div>
            <p className="font-black text-[#05469B] text-xl leading-none">{staffRolesStats.dvht}</p>
          </div>
          
          <div className="bg-white/80 rounded-2xl p-2 text-center border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition-all flex flex-col justify-between h-full cursor-help" title="Nhân sự Bảo vệ, Đón tiếp Khách hàng">
            <div className="h-7 flex items-center justify-center mb-1">
              <p className="text-[9px] font-black text-slate-500 uppercase leading-snug line-clamp-2">NS BV, ĐTKH</p>
            </div>
            <p className="font-black text-[#05469B] text-xl leading-none">{staffRolesStats.bv}</p>
          </div>
          
          <div className="bg-white/80 rounded-2xl p-2 text-center border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition-all flex flex-col justify-between h-full cursor-help" title="Nhân sự Phục vụ Hành chính">
            <div className="h-7 flex items-center justify-center mb-1">
              <p className="text-[9px] font-black text-slate-500 uppercase leading-snug line-clamp-2">NS PVHC</p>
            </div>
            <p className="font-black text-[#05469B] text-xl leading-none">{staffRolesStats.pvhc}</p>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 opacity-[0.02] pointer-events-none"><Users size={160}/></div>
      </div>
    </div>
  );
}
