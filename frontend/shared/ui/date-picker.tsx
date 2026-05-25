'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  className?: string;
}

export function DatePicker({ value, onChange, className }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDisplay = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handlePrevDay = () => {
    const newDate = new Date(value);
    newDate.setDate(value.getDate() - 1);
    onChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(value);
    newDate.setDate(value.getDate() + 1);
    onChange(newDate);
  };

  return (
    <div className={`date-picker-container ${className ?? ''}`} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button className="secondary-button" onClick={handlePrevDay} type="button" style={{ padding: '8px' }}>
        <ChevronLeft size={16} />
      </button>
      <button className="secondary-button date-display-btn" onClick={() => setIsOpen(!isOpen)} type="button" style={{ display: 'flex', alignItems: 'center', minWidth: '180px', justifyContent: 'center' }}>
        <CalendarIcon size={16} style={{ marginRight: '8px' }} />
        <span>{formatDisplay(value)}</span>
      </button>
      <button className="secondary-button" onClick={handleNextDay} type="button" style={{ padding: '8px' }}>
        <ChevronRight size={16} />
      </button>
      
      {isOpen && (
        <div className="date-picker-dropdown" style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px', zIndex: 50, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <input
            type="date"
            value={value.toISOString().slice(0, 10)}
            onChange={(e) => {
              if (e.target.value) {
                onChange(new Date(e.target.value));
                setIsOpen(false);
              }
            }}
            className="input"
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '0.875rem' }}
          />
        </div>
      )}
    </div>
  );
}
