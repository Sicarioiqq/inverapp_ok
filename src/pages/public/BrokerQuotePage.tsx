// src/pages/public/BrokerQuotePage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase'; // Ajusta la ruta
import { LayoutDashboard, Home, SlidersHorizontal, Loader2, AlertTriangle, ShieldX } from 'lucide-react'; // O los íconos que elijas

interface BrokerInfo {
  id: string;
  name: string | null;
  // Podrías cargar las comisiones aquí también o pasarlas a las pestañas
}

const BrokerQuotePage: React.FC = () => {
  const { brokerSlug, accessToken } = useParams<{ brokerSlug: string; accessToken: string }>();
  const navigate = useNavigate();

  const [brokerInfo, setBrokerInfo] = useState<BrokerInfo | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'principales' | 'secundarios' | 'configuracion'>('principales');

  useEffect(() => {
    if (!brokerSlug || !accessToken) {
      setError("Información de acceso inválida o incompleta.");
      setIsValidating(false);
      // Opcional: redirigir a una página de error o al login después de un tiempo
      // setTimeout(() => navigate('/login'), 5000); 
      return;
    }

    const validateAccessAndFetchBroker = async () => {
      setIsValidating(true);
      setError(null);
      try {
        // Busca al broker por slug y token.
        // Asegúrate de que la columna slug exista y esté poblada en tu tabla 'brokers'.
        // Si no usas slug, busca directamente por 'public_access_token' y ajusta la ruta.
        const { data, error: fetchError } = await supabase
          .from('brokers')
          .select('id, name') // Añade más campos si los necesitas del broker
          .eq('slug', brokerSlug) // O busca por 'id' si el slug no está implementado
          .eq('public_access_token', accessToken)
          .single(); // Esperamos un solo resultado

        if (fetchError || !data) {
          console.error("Error validando acceso o broker no encontrado:", fetchError);
          throw new Error("Acceso no autorizado o enlace inválido.");
        }

        setBrokerInfo(data as BrokerInfo);

      } catch (err: any) {
        setError(err.message || "Error al validar el acceso.");
        setBrokerInfo(null);
      } finally {
        setIsValidating(false);
      }
    };

    validateAccessAndFetchBroker();
  }, [brokerSlug, accessToken, navigate]);

  const renderTabContent = () => {
    if (!brokerInfo) return null; // No renderizar contenido si el broker no está validado

    switch (activeTab) {
      case 'principales':
        return <div>Contenido de Stock Principales para {brokerInfo.name} (ID: {brokerInfo.id})</div>; // Reemplazar con <BrokerStockPrincipales brokerId={brokerInfo.id} />
      case 'secundarios':
        return <div>Contenido de Stock Secundarios para {brokerInfo.name}</div>; // Reemplazar con <BrokerStockSecundarios brokerId={brokerInfo.id} />
      case 'configuracion':
        return <div>Contenido de Configuración de Cotización para {brokerInfo.name}</div>; // Reemplazar con <BrokerQuoteConfig />
      default:
        return null;
    }
  };

  if (isValidating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
        <p className="text-xl text-gray-700">Validando acceso...</p>
      </div>
    );
  }

  if (error || !brokerInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-4 text-center">
        <ShieldX className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-red-700 mb-2">Acceso Denegado</h1>
        <p className="text-red-600">{error || "No se pudo verificar la información del broker."}</p>
        <button 
          onClick={() => navigate('/login')} 
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Ir al Login
        </button>
      </div>
    );
  }

  // Si no hay error y tenemos brokerInfo, mostramos el cotizador
  // Este es un layout MUY BÁSICO. No incluye tu Sidebar/Header habitual
  // ya que es una página pública. Necesitarás un diseño específico para esto.
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header simple para el cotizador público */}
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-700">Cotizador Broker: {brokerInfo.name}</h1>
          {/* Podrías añadir un logo aquí */}
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6">
        {/* Pestañas de Navegación */}
        <div className="mb-6 border-b border-gray-300">
          <nav className="flex space-x-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('principales')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'principales' 
                  ? 'border-blue-600 text-blue-700' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-400'
              }`}
            >
              <Home className="inline-block h-5 w-5 mr-1.5 align-text-bottom" />
              Stock Principal
            </button>
            <button
              onClick={() => setActiveTab('secundarios')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'secundarios' 
                  ? 'border-blue-600 text-blue-700' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-400'
              }`}
            >
              <LayoutDashboard className="inline-block h-5 w-5 mr-1.5 align-text-bottom" />
              Stock Secundario
            </button>
            <button
              onClick={() => setActiveTab('configuracion')}
              className={`pb-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'configuracion' 
                  ? 'border-blue-600 text-blue-700' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-400'
              }`}
            >
              <SlidersHorizontal className="inline-block h-5 w-5 mr-1.5 align-text-bottom" />
              Configurar Cotización
            </button>
          </nav>
        </div>

        {/* Contenido de la Pestaña Activa */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          {renderTabContent()}
        </div>
      </main>

      <footer className="text-center py-8 text-sm text-gray-500">
        &copy; {new Date().getFullYear()} InverAPP - Cotizador para Brokers
      </footer>
    </div>
  );
};

export default BrokerQuotePage;