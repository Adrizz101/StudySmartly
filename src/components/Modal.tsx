import { Button } from '@/components/ui/button';
import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-study-black/60 backdrop-blur-sm animate-fadeIn" aria-label="Close dialog" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} glass rounded-2xl shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 glass z-10">
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            <Button variant="source"
              aria-label="Close dialog" onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-hover transition-colors text-text-muted hover:text-text"
            >
              <X size={18} />
            </Button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
