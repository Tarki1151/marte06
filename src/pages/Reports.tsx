// src/pages/Reports.tsx
import React from 'react';
import MonthlyAttendanceReport from '../components/MonthlyAttendanceReport.tsx'; // Aylık Katılım Raporu bileşenini import et
import './Reports.css'; // Sayfaya özgü stiller için

const Reports: React.FC = () => {
  return (
    <div className="reports-page"> {/* Ana konteyner */}
      <div className="page-header"> {/* Başlık için container */}
        <h2>Raporlama</h2>
      </div>

      {/* Aylık Katılım Raporu Bileşeni */}
      <MonthlyAttendanceReport />

      {/* Diğer raporlama içeriği buraya gelecek */}
      {/* İsterseniz buraya farklı rapor seçenekleri veya genel raporlama bilgileri ekleyebilirsiniz */}
      {/* <p>Çeşitli raporlar (üye aktifliği, ödemeler vb.) burada yer alacak.</p> */}
    </div>
  );
};

export default Reports;
