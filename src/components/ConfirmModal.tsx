// src/components/ConfirmModal.tsx
import React from 'react';
import './ConfirmModal.css'; // CSS dosyası

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void; // Evet tıklandığında
  onCancel: () => void;   // Hayır veya kapat tıklandığında
  isVisible: boolean;      // Modal görünür mü?
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ message, onConfirm, onCancel, isVisible }) => {
  if (!isVisible) return null; // Görünür değilse hiçbir şey render etme

  return (
    <div className="modal-overlay"> {/* Arkaplan overlay */} 
      <div className="modal-content"> {/* Modal içeriği */} 
        <p>{message}</p>
        <div className="modal-actions"> {/* Butonlar */} 
          <button onClick={onConfirm} className="confirm-button">Evet</button>
          <button onClick={onCancel} className="cancel-button">Hayır</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
