import React, { useMemo } from 'react';
import { Personnel } from '../../types';
import { Layers } from 'lucide-react';

interface PersonnelNgachLuongTabProps {
  personnelList: Personnel[];
}

export default function PersonnelNgachLuongTab({ personnelList }: PersonnelNgachLuongTabProps) {
  const { uniqueNgachLuong, groupedData } = useMemo(() => {
    // 1. Get all unique ngach_luong
    const activeStaff = personnelList.filter(p => p.trang_thai === 'Đang làm việc' || p.trang_thai === 'Đang thử việc');
    const ngachSet = new Set<string>();
    activeStaff.forEach(p => {
      const ngach = String(p.ngach_luong || '').trim();
      if (ngach && ngach !== '-' && ngach.toLowerCase() !== 'chưa có') {
        ngachSet.add(ngach);
      }
    });
    
    // Sort ngach_luong by length then alphabetically so they look nice
    const uniqueNgach = Array.from(ngachSet).sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      return a.localeCompare(b);
    });

    // 2. Group by Khoi -> Phong Ban
    const khoiMap = new Map<string, Map<string, Record<string, number>>>();
    const khoiTotals = new Map<string, Record<string, number>>();
    const grandTotals: Record<string, number> = {};

    activeStaff.forEach(p => {
      const khoi = (p.khoi || 'Khác').trim();
      const phongBan = (p.phong_ban || 'Chưa phân bộ').trim();
      const ngach = String(p.ngach_luong || '').trim();
      
      const validNgach = (ngach && ngach !== '-' && ngach.toLowerCase() !== 'chưa có') ? ngach : 'Chưa phân ngạch';

      if (!khoiMap.has(khoi)) {
        khoiMap.set(khoi, new Map());
        khoiTotals.set(khoi, {});
      }
      const pbMap = khoiMap.get(khoi)!;
      if (!pbMap.has(phongBan)) {
        pbMap.set(phongBan, {});
      }

      // Count for Phong Ban
      pbMap.get(phongBan)![validNgach] = (pbMap.get(phongBan)![validNgach] || 0) + 1;
      
      // Count for Khoi
      khoiTotals.get(khoi)![validNgach] = (khoiTotals.get(khoi)![validNgach] || 0) + 1;
      
      // Count for Grand Total
      grandTotals[validNgach] = (grandTotals[validNgach] || 0) + 1;
    });

    // 3. Flatten for rendering
    const rows: any[] = [];
    
    // Sort Khối
    const sortedKhoi = Array.from(khoiMap.keys()).sort();
    sortedKhoi.forEach(khoi => {
      const kTotals = khoiTotals.get(khoi)!;
      let khoiSum = 0;
      Object.values(kTotals).forEach(v => khoiSum += v);
      
      rows.push({
        type: 'khoi',
        name: khoi,
        counts: kTotals,
        total: khoiSum
      });

      const pbMap = khoiMap.get(khoi)!;
      const sortedPb = Array.from(pbMap.keys()).sort();
      sortedPb.forEach(pb => {
        const pTotals = pbMap.get(pb)!;
        let pbSum = 0;
        Object.values(pTotals).forEach(v => pbSum += v);
        
        rows.push({
          type: 'phong_ban',
          name: pb,
          counts: pTotals,
          total: pbSum
        });
      });
    });

    let superTotal = 0;
    Object.values(grandTotals).forEach(v => superTotal += v);

    return { 
      uniqueNgachLuong: [...uniqueNgach, 'Chưa phân ngạch'], 
      groupedData: {
        rows,
        grandTotals,
        superTotal
      }
    };
  }, [personnelList]);

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Layers size={18} className="text-[#05469B]" /> Cơ cấu Ngạch lương toàn hệ thống</h3>
            <p className="text-[11px] text-gray-500 mt-1">Phân bổ ngạch lương theo Khối và Bộ phận (chỉ tính nhân sự đang làm việc/thử việc).</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm min-w-[800px]">
            <thead className="bg-[#05469B] text-white">
              <tr>
                <th className="p-3 border border-blue-800/20 font-bold sticky left-0 z-10 bg-[#05469B] min-w-[250px]">KHỐI / BỘ PHẬN</th>
                {uniqueNgachLuong.map(ngach => (
                  <th key={ngach} className="p-3 border border-blue-800/20 text-center font-bold whitespace-nowrap">
                    {ngach}
                  </th>
                ))}
                <th className="p-3 border border-blue-800/20 text-center font-black bg-blue-900/50">TỔNG CỘNG</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.rows.map((row, idx) => (
                <tr key={idx} className={`border-b border-gray-200 hover:bg-blue-50/50 transition-colors ${row.type === 'khoi' ? 'bg-gray-100 font-bold text-gray-800' : 'bg-white text-gray-600'}`}>
                  <td className={`p-3 border-r border-gray-200 sticky left-0 z-10 ${row.type === 'khoi' ? 'bg-gray-100 pl-4 uppercase' : 'bg-white pl-10'}`}>
                    {row.name}
                  </td>
                  {uniqueNgachLuong.map(ngach => (
                    <td key={ngach} className={`p-3 border-r border-gray-200 text-center ${row.counts[ngach] ? 'font-medium' : 'text-gray-300'}`}>
                      {row.counts[ngach] || '-'}
                    </td>
                  ))}
                  <td className="p-3 border-r border-gray-200 text-center font-bold text-[#05469B] bg-blue-50/30">
                    {row.total}
                  </td>
                </tr>
              ))}
              <tr className="bg-amber-100 font-black text-amber-900 uppercase">
                <td className="p-3 border-r border-gray-200 sticky left-0 z-10 bg-amber-100">
                  TỔNG CỘNG TOÀN HỆ THỐNG
                </td>
                {uniqueNgachLuong.map(ngach => (
                  <td key={ngach} className="p-3 border-r border-gray-200 text-center">
                    {groupedData.grandTotals[ngach] || '-'}
                  </td>
                ))}
                <td className="p-3 border-r border-gray-200 text-center text-red-700 bg-amber-200/50">
                  {groupedData.superTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
