// src/components/PackageList.tsx
import React from 'react';
import type { Package } from '../types/Package';
import './PackageList.css';

interface PackageListProps {
  packages: Package[];
  onPackageEdited: (pkg: Package) => void;
  onPackageDeleted: (packageId: string) => void;
}

const PackageList: React.FC<PackageListProps> = ({ packages, onPackageEdited, onPackageDeleted }) => {
  if (packages.length === 0) {
    return <div style={{ textAlign: 'center', padding: '1.5rem', color: '#888' }}>Henüz tanımlı paket bulunmamaktadır.</div>;
  }

  return (
    <div className="package-list">
      <h3>Tanımlı Paketler</h3>
      <ul>
        {packages.map(pkg => (
          <li
            key={pkg.id}
            className={`package-list-item card ${pkg.isActive ? 'active-package' : 'inactive-package'}`}
          >
            <div className="package-info">
              <h4>{pkg.name}</h4>
              <div className="package-details">
                <span><strong>Fiyat:</strong> {pkg.price} TL</span>
                {pkg.lessonCount != null && <span><strong>Ders:</strong> {pkg.lessonCount}</span>}
                {pkg.durationDays != null && <span><strong>Süre:</strong> {pkg.durationDays} Gün</span>}
              </div>
            </div>
            <div className="package-actions">
                <button onClick={() => onPackageEdited(pkg)} className="button-edit">Düzenle</button>
                <button onClick={() => onPackageDeleted(pkg.id)} className="button-delete">Sil</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PackageList;
