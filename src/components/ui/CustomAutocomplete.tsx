import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface CustomAutocompleteProps {
  name: string;
  value: string;
  onChange: (e: any) => void;
  placeholder?: string;
  suggestions: string[];
  onRemove?: (item: string) => void;
  className?: string;
}

export default function CustomAutocomplete({
  name,
  value,
  onChange,
  placeholder,
  suggestions,
  onRemove,
  className
}: CustomAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = suggestions.filter((s: string) =>
    s.toLowerCase().includes((value || '').toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        name={name}
        value={value || ''}
        onChange={(e) => {
          onChange(e);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto custom-scrollbar">
          {filtered.map((item: string) => (
            <li
              key={item}
              className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center group text-sm text-gray-700 border-b border-gray-50 last:border-0"
              onClick={() => {
                onChange({ target: { name, value: item } });
                setIsOpen(false);
              }}
            >
              <span className="truncate pr-2">{item}</span>
              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item);
                  }}
                  className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Xóa khỏi danh sách gợi ý"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
