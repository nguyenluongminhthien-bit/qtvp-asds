import React, { useState, useMemo } from 'react';

interface PersonnelDoughnutChartProps {
  data: { name: string; count: number }[];
}

export default function PersonnelDoughnutChart({ data }: PersonnelDoughnutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = useMemo(() => data.reduce((sum, item) => sum + item.count, 0), [data]);

  const chartSegments = useMemo(() => {
    let accumulatedPercent = 0;
    const R = 85;
    const C = 2 * Math.PI * R; // 534.07
    const colors = ['#05469B', '#008080', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    return data.map((item, idx) => {
      const percent = total > 0 ? item.count / total : 0;
      const strokeDasharray = `${(percent * C).toFixed(2)} ${C.toFixed(2)}`;
      const strokeDashoffset = (-accumulatedPercent * C).toFixed(2);
      accumulatedPercent += percent;

      return {
        ...item,
        percent,
        color: colors[idx % colors.length],
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [data, total]);

  const activeItem = activeIndex !== null ? chartSegments[activeIndex] : null;

  return (
    <div className="flex flex-col items-center justify-between w-full h-full py-1 min-h-0">
      {/* VÙNG BIỂU ĐỒ TRÒN TO & DÀY HƠN */}
      <div className="relative w-[230px] h-[230px] sm:w-[250px] sm:h-[250px] shrink-0 flex items-center justify-center my-auto">
        <svg width="100%" height="100%" viewBox="0 0 220 220" className="transform -rotate-90 max-w-[240px] max-h-[240px]">
          <circle cx="110" cy="110" r="85" fill="transparent" stroke="#f8fafc" className="dark:stroke-slate-700/50" strokeWidth="30" />
          {chartSegments.map((seg, idx) => (
            <circle
              key={idx}
              cx="110"
              cy="110"
              r="85"
              fill="transparent"
              stroke={seg.color}
              strokeWidth={activeIndex === idx ? 36 : 30}
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={seg.strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300 cursor-pointer origin-center"
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{
                transform: activeIndex === idx ? 'scale(1.02)' : 'scale(1)',
                filter: activeIndex === idx ? 'drop-shadow(0px 3px 6px rgba(5,70,155,0.3))' : 'none'
              }}
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 pointer-events-none select-none">
          {activeItem ? (
            <>
              <p className="text-[11px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-wider truncate max-w-[110px]">{activeItem.name}</p>
              <p className="text-xl sm:text-2xl font-black text-gray-800 dark:text-white leading-tight my-1">{activeItem.count} NS</p>
              <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md shadow-sm border border-emerald-100 dark:border-emerald-800">{(activeItem.percent * 100).toFixed(1)}%</p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-wider">Tổng nhân sự</p>
              <p className="text-2xl sm:text-3xl font-black text-[#05469B] dark:text-blue-400 leading-tight my-1">{total}</p>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400">Người</p>
            </>
          )}
        </div>
      </div>

      {/* VÙNG CHÚ THÍCH BÊN DƯỚI: 2 DÒNG CÓ THANH CUỘN NHỎ */}
      <div className="w-full mt-2 shrink-0 overflow-y-auto max-h-[78px] custom-scrollbar pr-1.5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {chartSegments.map((seg, idx) => (
            <div 
              key={idx} 
              className={`flex items-center justify-between p-1.5 px-2 rounded-xl border border-gray-100 dark:border-slate-700/60 transition-all cursor-pointer ${activeIndex === idx ? 'bg-blue-50 dark:bg-slate-700 shadow-sm scale-[1.01] border-blue-200 dark:border-blue-700' : 'hover:bg-gray-50 dark:hover:bg-slate-700/40 bg-gray-50/50 dark:bg-slate-800/50'}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-1.5 truncate pr-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: seg.color }}></span>
                <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300 truncate" title={seg.name}>{seg.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[11px] font-black text-gray-800 dark:text-white">{seg.count}</span>
                <span className="text-[9px] font-bold text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-1 py-0.5 rounded shadow-2xs border border-gray-100 dark:border-slate-600">{(seg.percent * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
