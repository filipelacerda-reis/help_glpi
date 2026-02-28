import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface DarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

const DarkModal = ({ isOpen, onClose, title, children, maxWidth = 'md' }: DarkModalProps) => {
  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 pt-8 backdrop-blur-md sm:items-center sm:pt-4">
      <div
        className={`w-full ${maxWidthClasses[maxWidth]} max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(2,6,23,0.18)] dark:border-slate-700 dark:bg-slate-800`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default DarkModal;
