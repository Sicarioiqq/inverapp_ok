import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { User, Building, Home } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'client' | 'reservation' | 'apartment';
  title: string;
  subtitle: string;
  reservationFlowId?: string;
  is_rescinded?: boolean;
}

interface SearchResultsProps {
  results: SearchResult[];
  onSelect: () => void;
  isLoading: boolean;
  anchorRef: React.RefObject<HTMLInputElement>;
  open: boolean;
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, onSelect, isLoading, anchorRef, open }) => {
  const navigate = useNavigate();
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => {
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open, anchorRef]);

  const handleSelect = (result: SearchResult) => {
    if (result.reservationFlowId) {
      navigate(`/flujo-reservas/${result.reservationFlowId}`);
      onSelect();
      return;
    }
    if (result.type === 'client') {
      navigate(`/clientes/editar/${result.id}`);
    } else if (result.type === 'reservation') {
      navigate(`/reservas/editar/${result.id}`);
    }
    onSelect();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'client':
        return <User className="h-5 w-5 text-blue-500" />;
      case 'reservation':
        return <Building className="h-5 w-5 text-green-500" />;
      case 'apartment':
        return <Home className="h-5 w-5 text-purple-500" />;
      default:
        return null;
    }
  };

  if (!open) return null;

  const dropdown = (
    <div
      ref={dropdownRef}
      className="z-50 bg-white rounded-md shadow-lg max-h-96 overflow-y-auto border border-gray-200"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
      }}
    >
      {isLoading ? (
        <div className="p-4 text-center text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2">Buscando...</p>
        </div>
      ) : results.length === 0 ? null : (
        <ul className="py-1">
          {results.map((result) => (
            <li
              key={`${result.type}-${result.id}`}
              className={`${result.is_rescinded ? 'bg-red-50' : ''}`}
            >
              <button
                onClick={() => handleSelect(result)}
                className={`w-full px-4 py-2 text-left flex items-center ${result.is_rescinded ? 'hover:bg-red-100' : 'hover:bg-gray-100'}`}
              >
                <div className="flex-shrink-0 mr-3">{getIcon(result.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${result.is_rescinded ? 'text-red-800' : 'text-gray-900'}`}>
                    {result.title}
                    {result.is_rescinded && (
                      <span className="ml-1.5 text-xs font-semibold text-red-700">(Resciliada)</span>
                    )}
                  </p>
                  <p className={`text-sm truncate ${result.is_rescinded ? 'text-red-600' : 'text-gray-500'}`}>{result.subtitle}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return createPortal(dropdown, document.body);
};

export default SearchResults;