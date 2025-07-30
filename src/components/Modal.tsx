import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, actions }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {title && <div className="modal-title">{title}</div>}
        <div className="modal-content">{children}</div>
        {(actions || onClose) && (
          <div className="modal-actions">
            {actions}
            <button className="modal-close" onClick={onClose}>Kapat</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
