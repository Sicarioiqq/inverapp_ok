import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

interface PopupContextType {
  showPopup: (content: React.ReactNode, options?: PopupOptions) => void;
  hidePopup: () => void;
}

interface PopupOptions {
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

interface PopupProviderProps {
  children: React.ReactNode;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl'
};

export const PopupProvider: React.FC<PopupProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<React.ReactNode | null>(null);
  const [options, setOptions] = useState<PopupOptions>({});

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hidePopup();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const showPopup = useCallback((content: React.ReactNode, options: PopupOptions = {}) => {
    setContent(content);
    setOptions(options);
    setIsOpen(true);
  }, []);

  const hidePopup = useCallback(() => {
    setIsOpen(false);
    // Limpiar el contenido después de que la animación de cierre termine
    setTimeout(() => {
      setContent(null);
      setOptions({});
    }, 200);
  }, []);

  return (
    <PopupContext.Provider value={{ showPopup, hidePopup }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={hidePopup}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div 
              className={`relative bg-white rounded-lg shadow-xl w-full ${
                sizeClasses[options.size || 'md']
              } transform transition-all`}
            >
              {options.title && (
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {options.title}
                  </h3>
                  <button
                    onClick={hidePopup}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
              <div className="p-4">
                {content}
              </div>
            </div>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  );
};

export const usePopup = () => {
  const context = useContext(PopupContext);
  if (context === undefined) {
    throw new Error('usePopup must be used within a PopupProvider');
  }
  return context;
};