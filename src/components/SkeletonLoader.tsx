import React from 'react';

// Component xương sống chung — dùng được ở mọi nơi
const Pulse = ({ className }: { className?: string; key?: React.Key }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

// Skeleton cho bảng danh sách (Personnel, Vehicle, Equipment...)
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Pulse key={i} className={`h-3 ${i === 0 ? 'w-16' : i === cols - 1 ? 'w-20' : 'flex-1'}`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="p-4 border-b border-gray-100 flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div key={colIdx} className={`${colIdx === 0 ? 'w-16' : colIdx === cols - 1 ? 'w-20' : 'flex-1'}`}>
              <Pulse className="h-4 mb-1" />
              {colIdx === 1 && <Pulse className="h-3 w-2/3" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Skeleton cho card thống kê (Dashboard)
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <Pulse className="h-3 w-20 mb-3" />
      <Pulse className="h-8 w-16 mb-2" />
      <Pulse className="h-3 w-24" />
    </div>
  );
}

// Skeleton cho Dashboard cards grid
export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <Pulse className="h-4 w-32 mb-4" />
            <Pulse className="h-24 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton cho trang với sidebar filter (Personnel, Vehicle)
export function PageWithFilterSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Filter sidebar skeleton */}
      <div className="w-72 shrink-0 bg-white border-r border-gray-200 p-4 space-y-3">
        <Pulse className="h-8 w-full" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Pulse key={i} className={`h-8 ${i % 3 === 0 ? 'w-3/4' : 'w-full'}`} />
        ))}
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 p-6">
        <div className="flex justify-between mb-6">
          <Pulse className="h-8 w-48" />
          <div className="flex gap-3">
            <Pulse className="h-10 w-64" />
            <Pulse className="h-10 w-28" />
          </div>
        </div>
        <TableSkeleton rows={rows} cols={7} />
      </div>
    </div>
  );
}
