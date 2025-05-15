import React, { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateForInput } from '../lib/dateUtils';

interface DatePickerProps {
  id?: string;
  name?: string;
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
  placeholder = 'Seleccionar fecha...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    return value ? new Date(value) : new Date();
  });
  const calendarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Update current month when value changes
    if (value) {
      setCurrentMonth(new Date(value));
    }
  }, [value]);

  useEffect(() => {
    // Close calendar when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue === '') {
      onChange(null);
    } else {
      onChange(newValue);
    }
  };

  const handleDateSelect = (date: Date) => {
    const formattedDate = formatDateForInput(date);
    onChange(formattedDate);
    setIsOpen(false);
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    e.stopPropagation(); // Prevent event bubbling
    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    setCurrentMonth(prevMonth);
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    e.stopPropagation(); // Prevent event bubbling
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setCurrentMonth(nextMonth);
  };

  const renderCalendar = () => {
    const today = new Date();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get first day of month and last day of month
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // Get day of week of first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = firstDayOfMonth.getDay();
    
    // Get number of days in month
    const daysInMonth = lastDayOfMonth.getDate();
    
    // Create array of day numbers
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    // Add empty days at start to align with day of week
    const emptyDays = Array.from({ length: firstDayOfWeek }, (_, i) => i);
    
    // Get selected date
    const selectedDate = value ? new Date(value) : null;
    
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    const dayNames = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
    
    return (
      <div className="bg-white rounded-lg shadow-lg p-4 w-64 absolute z-10 mt-1">
        <div className="flex justify-between items-center mb-2">
          <button 
            onClick={handlePrevMonth}
            className="p-1 hover:bg-gray-100 rounded"
            type="button"
          >
            &lt;
          </button>
          <div className="font-semibold">
            {monthNames[month]} {year}
          </div>
          <button 
            onClick={handleNextMonth}
            className="p-1 hover:bg-gray-100 rounded"
            type="button"
          >
            &gt;
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
          {dayNames.map(day => (
            <div key={day} className="text-gray-500 font-medium">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1 text-center">
          {emptyDays.map(day => (
            <div key={`empty-${day}`} className="h-8 w-8"></div>
          ))}
          
          {days.map(day => {
            const date = new Date(year, month, day);
            const isToday = date.toDateString() === today.toDateString();
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
            
            return (
              <button
                key={day}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleDateSelect(date);
                }}
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm
                  ${isToday ? 'border border-blue-500' : ''}
                  ${isSelected ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="date"
          id={id}
          name={name}
          value={value || ''}
          onChange={handleInputChange}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${className}`}
          onClick={() => setIsOpen(true)}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <Calendar className="h-5 w-5 text-gray-400" />
        </div>
      </div>
      {isOpen && (
        <div ref={calendarRef}>
          {renderCalendar()}
        </div>
      )}
    </div>
  );
};

export default DatePicker;