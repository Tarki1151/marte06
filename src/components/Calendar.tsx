// src/components/Calendar.tsx
import React, { useState, useEffect } from 'react';
import './Calendar.css'; // CSS dosyası

interface CalendarProps {
  onDateSelect: (date: Date | null) => void; // Dışa seçilen tarihi bildirmek için callback
}

const Calendar: React.FC<CalendarProps> = ({ onDateSelect }) => {
  const [currentDate, setCurrentDate] = useState(new Date()); // Takvimde görünen ay/yıl
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // Kullanıcının seçtiği tarih

  // currentDatetestiği zaman selectedDate'i sıfırlama (isteğe bağlı)
  useEffect(() => {
    setSelectedDate(null);
    onDateSelect(null);
  }, [currentDate]);

  const renderHeader = () => {
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const month = monthNames[currentDate.getMonth()];
    const year = currentDate.getFullYear();

    return (
      <div className="calendar-header">
        <button onClick={prevMonth}>Önceki</button>
        <h2>{month} {year}</h2>
        <button onClick={nextMonth}>Sonraki</button>
      </div>
    );
  };

  const renderDaysOfWeek = () => {
    const daysOfWeek = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    return (
      <div className="days-of-week">
        {daysOfWeek.map(day => <div key={day}>{day}</div>)}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(monthStart);
    // Ayın ilk gününün haftanın hangi gününe denk geldiğini bul (Pazar 0, Pzt 1, ...) ve Pazartesi 0 olacak şekilde ayarla
    const dayOfWeek = monthStart.getDay();
    const startDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Pazar 0 ise 6 (Cumartesi), diğerleri kendi gün indexi - 1

    startDate.setDate(monthStart.getDate() - startDayIndex);

    const cells = [];
    let currentDay = new Date(startDate);

    while (currentDay <= monthEnd || currentDay.getDay() !== (dayOfWeek === 0 ? 0 : dayOfWeek - 1) || cells.length % 7 !== 0) { // Tam hafta dolana kadar veya ay bitene kadar
      const day = new Date(currentDay);
      const isToday = day.toDateString() === new Date().toDateString();
      const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString();
      const isCurrentMonth = day.getMonth() === currentDate.getMonth();

      cells.push(
        <div
          key={day.toDateString()}
          className={`calendar-cell ${!isCurrentMonth ? 'disabled' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => isCurrentMonth && handleDateClick(day)}
        >
          {day.getDate()}
        </div>
      );
      currentDay.setDate(currentDay.getDate() + 1);
       if (cells.length > 35 && !isCurrentMonth && currentDay.getDay() === (dayOfWeek === 0 ? 0 : dayOfWeek - 1)) break; // Çok uzun döngüyü önlemek için
         if (cells.length > 42) break; // Maksimum 6 hafta (42 gün) göster

    }

    return <div className="calendar-cells">{cells}</div>;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect(date); // Callback ile üst bileşene seçilen tarihi bildir
  };

  return (
    <div className="calendar-container card"> {/* .card class'ı kullanıldı */} 
      {renderHeader()}
      {renderDaysOfWeek()}
      {renderCells()}
    </div>
  );
};

export default Calendar;
