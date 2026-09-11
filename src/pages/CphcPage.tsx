import React, { useState, useRef, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';

interface CphcPageProps {
  onExit: () => void;
}

const BASE_CPHC_URL = 'https://nguyenluongminhthien-bit.github.io/qlcphc/';

/**
 * Tạo URL iframe cho CPHC:
 * Nếu có cấu hình VITE_CPHC_API_URL và/hoặc VITE_CPHC_API_KEY (từ Vercel env),
 * truyền qua query parameters để tránh lỗi Storage Partitioning trên iframe.
 * Nếu không có biến môi trường (dev local), tải URL gốc để fallback.
 */
const getCphcUrl = (): string => {
  const apiUrl = import.meta.env.VITE_CPHC_API_URL?.trim();
  const apiKey = import.meta.env.VITE_CPHC_API_KEY?.trim();

  if (!apiUrl && !apiKey) {
    return BASE_CPHC_URL;
  }

  try {
    const url = new URL(BASE_CPHC_URL);
    if (apiUrl) url.searchParams.set('apiUrl', apiUrl);
    if (apiKey) url.searchParams.set('apiKey', apiKey);
    return url.toString();
  } catch (err) {
    console.error('Lỗi khi khởi tạo CPHC URL:', err);
    return BASE_CPHC_URL;
  }
};

export default function CphcPage({ onExit }: CphcPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 16, y: 12 });
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number; hasMoved: boolean } | null>(null);
  const cphcUrl = useMemo(() => getCphcUrl(), []);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
      hasMoved: false
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragStartRef.current.hasMoved = true;
        setPosition({
          x: Math.max(8, Math.min(window.innerWidth - 130, dragStartRef.current.posX + dx)),
          y: Math.max(8, Math.min(window.innerHeight - 45, dragStartRef.current.posY + dy))
        });
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    dragStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      posX: position.x,
      posY: position.y,
      hasMoved: false
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragStartRef.current || !e.touches[0]) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragStartRef.current.hasMoved = true;
      setPosition({
        x: Math.max(8, Math.min(window.innerWidth - 90, dragStartRef.current.posX + dx)),
        y: Math.max(8, Math.min(window.innerHeight - 45, dragStartRef.current.posY + dy))
      });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (dragStartRef.current?.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onExit();
  };

  return (
    <div className="relative w-full h-screen h-[100dvh] overflow-hidden bg-[#f4f7f9]">
      {/* 🟢 DUY NHẤT 1 NÚT NỔI THOÁT TOÀN MÀN HÌNH (CÓ THỂ KÉO THẢ TÙY Ý TRÁNH CẢN HIỂN THỊ) */}
      <div
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        className="fixed z-[9999] pointer-events-auto select-none"
      >
        <button
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          title="Bấm để quay lại Menu (hoặc kéo rê để đổi vị trí bất kỳ)"
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#05408A]/90 hover:bg-[#05408A] text-white shadow-xl backdrop-blur-md border border-white/30 transition-shadow active:scale-95 cursor-grab active:cursor-grabbing opacity-90 hover:opacity-100"
        >
          <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5 shrink-0" />
          <span className="text-xs font-bold tracking-tight hidden sm:inline whitespace-nowrap">Quay lại Menu</span>
          <span className="text-xs font-bold sm:hidden whitespace-nowrap">QTVP</span>
        </button>
      </div>

      {/* 🟢 HIỆU ỨNG TẢI TRANG (LOADING SPINNER) */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#f4f7f9] gap-3">
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-3 border-blue-200 border-t-[#05408A] animate-spin"></div>
            <div className="absolute text-[11px] font-black text-[#05408A]">CP</div>
          </div>
          <p className="text-sm font-semibold text-gray-600 animate-pulse">
            Đang tải Quản lý Chi phí Hành chính...
          </p>
          <p className="text-xs text-gray-400">
            Hệ thống độc lập (App-in-App)
          </p>
        </div>
      )}

      {/* 🟢 VÙNG NHÚNG IFRAME CPHC */}
      <div className="w-full h-full overflow-auto -webkit-overflow-scrolling-touch">
        <iframe
          src={cphcUrl}
          title="Quản lý Chi phí Hành chính (CPHC)"
          className="w-full h-full border-0 block"
          allow="clipboard-read; clipboard-write; fullscreen"
          loading="lazy"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
}
