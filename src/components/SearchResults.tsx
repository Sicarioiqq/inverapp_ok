import React from 'react';
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
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, onSelect, isLoading }) => {
  const navigate = useNavigate();

  const handleSelect = (result: SearchResult) => {
    // Always navigate to the reservation flow if available
    if (result.reservationFlowId) {
      navigate(`/flujo-reservas/${result.reservationFlowId}`);
      onSelect();
      return;
    }
    
    // Fallback navigation if no reservation flow ID is available
    if (result.type === 'client') {
      // For clients, we would ideally find their reservations first
      // But as a fallback, go to client edit page
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

  if (isLoading) {
    return (
      <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg max-h-96 overflow-y-auto border border-gray-200">
        <div className="p-4 text-center text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2">Buscando...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
  <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg max-h-96 overflow-y-auto border border-gray-200">
    <ul className="py-1">
      {results.map((result) => (
        <li 
          key={`<span class="math-inline">\{result\.type\}\-</span>{result.id}`}
          // Aplicar un fondo rojo claro si está rescindida
          className={`${result.is_rescinded ? 'bg-red-50' : ''}`} 
        >
          <button
            onClick={() => handleSelect(result)}
            // Cambiar el hover si está rescindida
            className={`w-full px-4 py-2 text-left flex items-center ${result.is_rescinded ? 'hover:bg-red-100' : 'hover:bg-gray-100'}`}
          >
            <div className="flex-shrink-0 mr-3">
              {getIcon(result.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${result.is_rescinded ? 'text-red-800' : 'text-gray-900'}`}>
                {result.title}
                {/* Añadir etiqueta "(Resciliada)" */}
                {result.is_rescinded && (
                  <span className="ml-1.5 text-xs font-semibold text-red-700">(Resciliada)</span>
                )}
              </p>
              <p className={`text-sm truncate ${result.is_rescinded ? 'text-red-600' : 'text-gray-500'}`}>
                {result.subtitle}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  </div>
);
};

export default SearchResults;