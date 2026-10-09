import React, { useMemo, useState, useEffect } from 'react';
import { Personnel } from '../../types';
import { apiService } from '../../services/api';
import { Users, PieChart as PieChartIcon, BarChart3, TrendingUp, ShieldCheck, Cake, UserCheck, Crown, Activity, UserRoundPlus, VenusAndMars, LucideUserRoundCog, UserCheck2 } from 'lucide-react';

interface Props {
  personnelList: Personnel[];
}

export default function PersonnelDashboardTab({ personnelList }: Props) {
  const [hocVienList, setHocVienList] = useState<any[]>([]);
  const [selectedKhoi, setSelectedKhoi] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (apiService.getHocVienKhoaHuanLuyen) {
      apiService.getHocVienKhoaHuanLuyen().then(res => {
        if (mounted && Array.isArray(res)) setHocVienList(res);
      }).catch(console.error);
    }
    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => {
    const activeStaff = personnelList.filter(p => p.trang_thai === 'Đang làm việc' || p.trang_thai === 'Đang thử việc');
    const total = activeStaff.length;

    // Nhóm 1: Tổng quan
    let male = 0;
    let female = 0;
    let totalAge = 0;
    let countAge = 0;
    let totalSeniorityMonths = 0;
    let countSeniority = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let newThisMonth = 0;

    // Nhóm 2
    const khoiCount: Record<string, number> = {};
    const khoiToPb: Record<string, Record<string, number>> = {};
    let managerCount = 0;
    let staffCount = 0;
    const chucDanhCount: Record<string, number> = {};

    // Nhóm 3
    const agePyramidKeys = ['<25', '25-30', '31-35', '36-40', '41-50', '>50'];
    const agePyramid = {
      '<25': { m: 0, f: 0 },
      '25-30': { m: 0, f: 0 },
      '31-35': { m: 0, f: 0 },
      '36-40': { m: 0, f: 0 },
      '41-50': { m: 0, f: 0 },
      '>50': { m: 0, f: 0 }
    };

    const generations = {
      'Gen Z (Sau 1997)': 0, // >= 1997
      'Gen Y/Millennials (1981-1996)': 0, // 1981 - 1996
      'Gen X (1965-1980)': 0, // 1965 - 1980
      'Baby Boomer (Trước 1965)': 0 // < 1965
    };

    // Nhóm 4
    const seniorityGroupsKeys = ['<1 năm', '1-3 năm', '3-5 năm', '5-10 năm', '>10 năm'];
    const seniorityGroups = {
      '<1 năm': 0,
      '1-3 năm': 0,
      '3-5 năm': 0,
      '5-10 năm': 0,
      '>10 năm': 0
    };
    const upcomingAnniversaries: any[] = [];

    activeStaff.forEach(p => {
      // Giới tính
      const gt = String(p.gioi_tinh || '').toLowerCase().trim();
      const isMale = gt === 'nam';
      const isFemale = gt === 'nữ' || gt === 'nu';
      if (isMale) male++;
      else if (isFemale) female++;

      // Độ tuổi & Thế hệ
      let birthYear = 0;
      if (p.nam_sinh) {
        const d = new Date(p.nam_sinh);
        if (!isNaN(d.getTime())) {
          birthYear = d.getFullYear();
          const age = currentYear - birthYear;
          totalAge += age;
          countAge++;

          let ageGroup = '<25';
          if (age < 25) ageGroup = '<25';
          else if (age <= 30) ageGroup = '25-30';
          else if (age <= 35) ageGroup = '31-35';
          else if (age <= 40) ageGroup = '36-40';
          else if (age <= 50) ageGroup = '41-50';
          else ageGroup = '>50';

          if (isMale) agePyramid[ageGroup as keyof typeof agePyramid].m++;
          else if (isFemale) agePyramid[ageGroup as keyof typeof agePyramid].f++;

          if (birthYear >= 1997) generations['Gen Z (Sau 1997)']++;
          else if (birthYear >= 1981) generations['Gen Y/Millennials (1981-1996)']++;
          else if (birthYear >= 1965) generations['Gen X (1965-1980)']++;
          else generations['Baby Boomer (Trước 1965)']++;
        }
      }

      // Thâm niên
      if (p.ngay_nhan_vien) {
        const d = new Date(p.ngay_nhan_vien);
        if (!isNaN(d.getTime())) {
          const startYear = d.getFullYear();
          const startMonth = d.getMonth();
          const months = (currentYear - startYear) * 12 + (currentMonth - startMonth);
          if (months >= 0) {
            totalSeniorityMonths += months;
            countSeniority++;

            const years = months / 12;
            if (years < 1) seniorityGroups['<1 năm']++;
            else if (years < 3) seniorityGroups['1-3 năm']++;
            else if (years < 5) seniorityGroups['3-5 năm']++;
            else if (years < 10) seniorityGroups['5-10 năm']++;
            else seniorityGroups['>10 năm']++;
          }

          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            newThisMonth++;
          }

          // Kỷ niệm
          const nextAnnivDate = new Date(currentYear, startMonth, d.getDate());
          if (nextAnnivDate < now) {
            nextAnnivDate.setFullYear(currentYear + 1);
          }
          const daysToAnniv = (nextAnnivDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
          if (daysToAnniv >= 0 && daysToAnniv <= 30) {
            const annivYears = nextAnnivDate.getFullYear() - startYear;
            if ([1, 3, 5, 10, 15, 20].includes(annivYears)) {
              upcomingAnniversaries.push({ ...p, annivYears, date: nextAnnivDate });
            }
          }
        }
      }

      // Khối & Bộ phận
      const khoi = (p.khoi || 'Khác').trim();
      const pb = (p.phong_ban || 'Chưa phân bộ').trim();
      khoiCount[khoi] = (khoiCount[khoi] || 0) + 1;

      if (!khoiToPb[khoi]) khoiToPb[khoi] = {};
      khoiToPb[khoi][pb] = (khoiToPb[khoi][pb] || 0) + 1;

      // Quản lý / Nhân viên
      const cv = String(p.chuc_vu || '').toLowerCase();
      if (cv.includes('trưởng') || cv.includes('phó') || cv.includes('giám đốc') || cv.includes('quản lý')) {
        managerCount++;
      } else {
        staffCount++;
      }

      // Chức danh
      const cd = String(p.chuc_danh || '').trim();
      if (cd) {
        chucDanhCount[cd] = (chucDanhCount[cd] || 0) + 1;
      }
    });

    upcomingAnniversaries.sort((a, b) => a.date.getTime() - b.date.getTime());

    const topChucDanh = Object.entries(chucDanhCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // ATVSLD
    const trainedMsnv = new Set(hocVienList
      .filter(h => h.ket_qua === 'Đạt' || h.ket_qua === 'Khá' || h.ket_qua === 'Giỏi' || (Number(h.diem_ly_thuyet) >= 5 && Number(h.diem_thuc_hanh) >= 5))
      .map(h => h.msnv)
    );

    const atvsldStats: Record<string, { total: number, trained: number }> = {};
    activeStaff.forEach(p => {
      let nhom = String(p.nhom_doi_tuong || '').trim();
      if (!nhom || nhom === '-') nhom = 'Chưa phân nhóm';

      if (!atvsldStats[nhom]) atvsldStats[nhom] = { total: 0, trained: 0 };
      atvsldStats[nhom].total++;

      if (trainedMsnv.has(p.ma_so_nhan_vien)) {
        atvsldStats[nhom].trained++;
      }
    });

    // max counts for scaling charts
    let maxPyramid = 0;
    Object.values(agePyramid).forEach(v => {
      if (v.m > maxPyramid) maxPyramid = v.m;
      if (v.f > maxPyramid) maxPyramid = v.f;
    });

    return {
      total, male, female,
      avgAge: countAge ? (totalAge / countAge).toFixed(1) : '0',
      avgSeniority: countSeniority ? (totalSeniorityMonths / countSeniority / 12).toFixed(1) : '0',
      newThisMonth,
      khoiCount, khoiToPb, managerCount, staffCount, topChucDanh,
      agePyramid, agePyramidKeys, maxPyramid, generations,
      seniorityGroups, seniorityGroupsKeys, upcomingAnniversaries,
      atvsldStats
    };
  }, [personnelList, hocVienList]);

  return (
    <div className="transition-all duration-300 space-y-8">
      {/* 🔴 NHÓM 1: TỔNG QUAN */}
      <section>
        <h2 className="text-lg font-black text-[#00539c] mb-4 flex items-center gap-2">
          <Activity size={20} /> NHÓM 1: TỔNG QUAN
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col items-center justify-center text-center">
            <UserCheck2 className="w-8 h-8 text-blue-500 mb-2" />
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Tổng CB-NV</p>
            <p className="text-2xl font-black text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-pink-200 shadow-sm flex flex-col items-center justify-center text-center">
            <VenusAndMars className="w-8 h-8 text-pink-500 mb-2" />
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Tỷ lệ Nam / Nữ</p>
            <p className="text-xl font-black text-gray-800">
              {stats.total ? Math.round(stats.male / stats.total * 100) : 0}% <span className="text-blue-500">M</span> / {stats.total ? Math.round(stats.female / stats.total * 100) : 0}% <span className="text-pink-500">F</span>
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex flex-col items-center justify-center text-center">
            <PieChartIcon className="w-8 h-8 text-amber-500 mb-2" />
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Độ tuổi TB</p>
            <p className="text-2xl font-black text-gray-800">{stats.avgAge} <span className="text-sm text-gray-500">tuổi</span></p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex flex-col items-center justify-center text-center">
            <TrendingUp className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Thâm niên TB</p>
            <p className="text-2xl font-black text-gray-800">{stats.avgSeniority} <span className="text-sm text-gray-500">năm</span></p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center text-center">
            <UserRoundPlus className="w-8 h-8 text-indigo-500 mb-2" />
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">NV mới trong tháng</p>
            <p className="text-2xl font-black text-gray-800">{stats.newThisMonth}</p>
          </div>
        </div>
      </section>

      {/* 🔴 NHÓM 2: CƠ CẤU TỔ CHỨC */}
      <section>
        <h2 className="text-lg font-black text-[#00539c] mb-4 flex items-center gap-2">
          <BarChart3 size={20} /> NHÓM 2: CƠ CẤU TỔ CHỨC
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm md:col-span-2">
            <h3 className="font-bold text-gray-800 mb-4 text-sm">Số lượng theo Khối &amp; Bộ phận trực thuộc</h3>
            {!selectedKhoi ? (
              <div className="space-y-3">
                {Object.entries(stats.khoiCount).sort((a, b) => b[1] - a[1]).map(([khoi, count]) => (
                  <div key={khoi} className="cursor-pointer group" onClick={() => setSelectedKhoi(khoi)}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-gray-700 group-hover:text-blue-600 transition-colors flex items-center gap-1">{khoi} <span className="text-blue-400 opacity-0 group-hover:opacity-100 text-[10px]">(Bấm xem chi tiết)</span></span>
                      <span className="text-gray-600">{count} NV</span>
                    </div>
                    <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 group-hover:bg-blue-400 transition-all" style={{ width: `${(count / stats.total) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <button onClick={() => setSelectedKhoi(null)} className="mb-4 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">← Quay lại danh sách Khối</button>
                <h4 className="font-black text-gray-700 mb-3 text-sm">Chi tiết Bộ phận thuộc: {selectedKhoi}</h4>
                <div className="space-y-3">
                  {Object.entries(stats.khoiToPb[selectedKhoi]).sort((a, b) => b[1] - a[1]).map(([pb, count]) => (
                    <div key={pb}>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-gray-600">{pb}</span>
                        <span className="text-gray-600">{count} NV</span>
                      </div>
                      <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(count / stats.khoiCount[selectedKhoi]) * 100}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 text-sm">Tỷ lệ Quản lý / Nhân viên</h3>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-lg font-black text-white shrink-0" style={{
                  background: `conic-gradient(#3b82f6 0% ${stats.managerCount / stats.total * 100}%, #e2e8f0 ${stats.managerCount / stats.total * 100}% 100%)`
                }}>
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-gray-800 shadow-inner text-sm">
                    {Math.round(stats.managerCount / stats.total * 100)}%
                  </div>
                </div>
                <div className="flex-1 text-sm font-bold text-gray-600 space-y-2">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-blue-500"></span> Quản lý: {stats.managerCount}</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-slate-200"></span> Nhân viên: {stats.staffCount}</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2"><Crown size={16} className="text-amber-500" /> Top Chức danh đông nhất</h3>
              <ul className="space-y-2">
                {stats.topChucDanh.map(([cd, count], idx) => (
                  <li key={cd} className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-600 truncate mr-2" title={cd}>{idx + 1}. {cd}</span>
                    <span className="bg-gray-100 text-gray-600 font-black px-2 py-0.5 rounded shrink-0">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 🔴 NHÓM 3: NHÂN KHẨU & ATLĐ */}
      <section>
        <h2 className="text-lg font-black text-[#00539c] mb-4 flex items-center gap-2">
          <ShieldCheck size={20} /> NHÓM 3: NHÂN KHẨU &amp; AN TOÀN LAO ĐỘNG
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 text-sm text-center">Tháp tuổi &amp; Cơ cấu Giới tính</h3>
            <div className="mb-4">
              <div className="flex justify-between mb-1.5 text-[11px] font-bold">
                <span className="text-blue-600 flex items-center gap-1">Nam: {stats.male} ({stats.total > 0 ? Math.round(stats.male / stats.total * 100) : 0}%)</span>
                <span className="text-pink-500 flex items-center gap-1">({stats.total > 0 ? Math.round(stats.female / stats.total * 100) : 0}%) {stats.female} :Nữ</span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${stats.total > 0 ? (stats.male / stats.total) * 100 : 0}%` }}></div>
                <div className="h-full bg-pink-400 transition-all duration-1000" style={{ width: `${stats.total > 0 ? (stats.female / stats.total) * 100 : 0}%` }}></div>
              </div>
            </div>

            <div className="flex justify-center gap-12 text-[10px] font-black text-gray-400 mb-2 mt-2 pt-4 border-t border-gray-100">
              <span>NAM</span>
              <span>NỮ</span>
            </div>
            <div className="space-y-1.5">
              {stats.agePyramidKeys.map(group => {
                const data = stats.agePyramid[group as keyof typeof stats.agePyramid];
                const mPct = stats.maxPyramid ? (data.m / stats.maxPyramid) * 100 : 0;
                const fPct = stats.maxPyramid ? (data.f / stats.maxPyramid) * 100 : 0;
                return (
                  <div key={group} className="flex items-center gap-2 text-xs">
                    <div className="flex-1 flex justify-end">
                      <div className="h-4 bg-blue-500 rounded-l-sm flex items-center justify-end pr-1 text-[9px] text-white font-bold" style={{ width: `${mPct}%`, minWidth: data.m ? '20px' : '0' }}>{data.m || ''}</div>
                    </div>
                    <div className="w-12 text-center font-bold text-gray-600">{group}</div>
                    <div className="flex-1 flex justify-start">
                      <div className="h-4 bg-pink-400 rounded-r-sm flex items-center justify-start pl-1 text-[9px] text-white font-bold" style={{ width: `${fPct}%`, minWidth: data.f ? '20px' : '0' }}>{data.f || ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 text-sm">Phân bổ Độ tuổi (Thế hệ)</h3>
            <div className="space-y-4">
              {Object.entries(stats.generations).map(([gen, count]) => (
                <div key={gen}>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-gray-700">{gen}</span>
                    <span className="text-gray-600">{count} ({stats.total ? Math.round(count / stats.total * 100) : 0}%)</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${(count / stats.total) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <h3 className="font-bold text-gray-800 mb-4 text-sm">Tỷ lệ Huấn luyện ATVSLĐ theo Nhóm</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
              {Object.entries(stats.atvsldStats).map(([nhom, data]) => {
                const pct = data.total ? Math.round((data.trained / data.total) * 100) : 0;
                return (
                  <div key={nhom}>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-gray-700 truncate mr-2" title={nhom}>{nhom}</span>
                      <span className="text-emerald-600 shrink-0">{data.trained}/{data.total} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-orange-400' : 'bg-red-500'}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 🔴 NHÓM 4: THÂM NIÊN NHÂN SỰ */}
      <section>
        <h2 className="text-lg font-black text-[#00539c] mb-4 flex items-center gap-2">
          <Cake size={20} /> NHÓM 4: THÂM NIÊN NHÂN SỰ
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
            <h3 className="font-bold text-gray-800 mb-6 text-sm text-center">Thâm niên công tác</h3>
            <div className="flex items-end justify-around h-32 pt-4 border-b border-gray-200">
              {stats.seniorityGroupsKeys.map(label => {
                const count = stats.seniorityGroups[label as keyof typeof stats.seniorityGroups];
                const max = Math.max(...Object.values(stats.seniorityGroups));
                const heightPercent = max > 0 ? (count / max) * 100 : 0;
                return (
                  <div key={label} className="flex flex-col items-center justify-end h-full group w-1/5">
                    <span className="text-xs font-bold text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{count}</span>
                    <div className="flex items-end justify-center w-full flex-1 border-b border-gray-200 pb-0">
                      <div className="w-6 sm:w-10 bg-indigo-500 rounded-t-sm transition-all duration-300 group-hover:bg-indigo-400" style={{ height: `${heightPercent}%`, minHeight: count > 0 ? '4px' : '0px' }}></div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-600 mt-2 text-center h-4 whitespace-nowrap">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-orange-50/50">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2"><Cake size={16} className="text-orange-500" /> Sắp đến Kỷ niệm làm việc (Trong 30 ngày)</h3>
            </div>
            <div className="flex-1 max-h-48 overflow-y-auto custom-scrollbar">
              {stats.upcomingAnniversaries.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm font-medium">Không có nhân sự nào sắp kỷ niệm 1, 3, 5, 10 năm trong 30 ngày tới.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {stats.upcomingAnniversaries.map((p, idx) => (
                    <li key={idx} className="p-3 hover:bg-orange-50/30 transition-colors flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-800 text-xs">{p.ho_ten}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{p.chuc_vu}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 font-black text-[10px] rounded-md">Tròn {p.annivYears} năm</span>
                        <p className="text-[9px] font-bold text-gray-400 mt-1">Vào ngày {p.date.toLocaleDateString('vi-VN')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
