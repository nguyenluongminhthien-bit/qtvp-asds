import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  rowsPerPage: number | string;
  totalRows: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  itemName?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  rowsPerPage,
  totalRows,
  onPageChange,
  onRowsPerPageChange,
  itemName = 'bản ghi'
}: PaginationProps) {
  const actualRowsPerPage = typeof rowsPerPage === 'number' && rowsPerPage > 0 ? rowsPerPage : 100;

  if (totalRows === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 gap-4 shrink-0">
      <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          title="Trang trước"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="flex items-center gap-2">
          Trang
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              let val = parseInt(e.target.value);
              if (!isNaN(val)) {
                if (val > totalPages) val = totalPages;
                if (val < 1) val = 1;
                onPageChange(val);
              }
            }}
            className="w-12 text-center border border-gray-300 rounded p-1 outline-none focus:border-[#05469B] focus:ring-1 focus:ring-[#05469B]"
          />
          / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          title="Trang sau"
        >
          <ChevronRight size={16} />
        </button>
        <div className="flex items-center gap-2 ml-2 sm:ml-4 pl-2 sm:pl-4 border-l border-gray-300">
          <input
            type="number"
            min={1}
            value={rowsPerPage}
            onChange={(e) => {
              const val = e.target.value;
              onRowsPerPageChange(val === '' ? 100 : parseInt(val));
            }}
            className="w-16 text-center border border-gray-300 rounded p-1 outline-none focus:border-[#05469B] text-[#05469B] font-bold"
          />
          <span>dòng</span>
        </div>
      </div>
      <div className="text-sm text-gray-500 hidden md:block">
        Hiển thị {Math.min((currentPage - 1) * actualRowsPerPage + 1, totalRows)} - {Math.min(currentPage * actualRowsPerPage, totalRows)} trong tổng số{' '}
        <span className="font-bold text-gray-800">{totalRows}</span> {itemName}
      </div>
    </div>
  );
}
