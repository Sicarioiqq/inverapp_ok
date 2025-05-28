import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Key, Copy, RefreshCw, Loader2 } from 'lucide-react';

interface Broker {
  id: string;
  name: string;
  business_name: string;
  public_access_token: string | null;
  slug: string | null;
}

const BrokerTokenGenerator: React.FC = () => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBrokers();
  }, []);

  const fetchBrokers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('brokers')
        .select('id, name, business_name, public_access_token, slug')
        .order('name');

      if (error) throw error;
      setBrokers(data || []);
    } catch (err: any) {
      setError(err.message);
      toast.error(`Error al cargar brokers: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateToken = async (brokerId: string) => {
    try {
      setGenerating(prev => ({ ...prev, [brokerId]: true }));
      
      // Generate a random token
      const token = Math.random().toString(36).substring(2, 15) + 
                   Math.random().toString(36).substring(2, 15);
      
      // Generate a slug from the broker name
      const broker = brokers.find(b => b.id === brokerId);
      if (!broker) throw new Error('Broker no encontrado');
      
      let slug = broker.slug;
      
      // If no slug exists, create one from the name
      if (!slug) {
        slug = broker.name
          .toLowerCase()
          .replace(/[^\w\s]/gi, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-'); // Replace multiple hyphens with a single one
      }
      
      // Update the broker with the new token and slug
      const { error } = await supabase
        .from('brokers')
        .update({ 
          public_access_token: token,
          slug: slug
        })
        .eq('id', brokerId);

      if (error) throw error;
      
      // Refresh the brokers list
      fetchBrokers();
      toast.success('Token generado exitosamente');
    } catch (err: any) {
      setError(err.message);
      toast.error(`Error al generar token: ${err.message}`);
    } finally {
      setGenerating(prev => ({ ...prev, [brokerId]: false }));
    }
  };

  const copyToClipboard = (text: string, brokerName: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast.success(`URL copiada al portapapeles`);
      })
      .catch(err => {
        console.error('Error al copiar:', err);
        toast.error('Error al copiar al portapapeles');
      });
  };

  const getQuoteUrl = (broker: Broker) => {
    if (!broker.slug || !broker.public_access_token) return '';
    
    // Use window.location to get the base URL
    const baseUrl = window.location.origin;
    return `${baseUrl}/cotizador-broker/${broker.slug}/${broker.public_access_token}`;
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-3 text-gray-700">Cargando brokers...</span>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-lg p-6 overflow-auto">
      <div className="flex items-center mb-6">
        <Key className="h-6 w-6 text-blue-600 mr-2" />
        <h3 className="text-xl font-semibold text-gray-800">Generador de Tokens para Cotizador</h3>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broker</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL de Cotizador</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {brokers.map(broker => (
              <tr key={broker.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{broker.name}</div>
                  <div className="text-sm text-gray-500">{broker.business_name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {broker.slug || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {broker.public_access_token ? (
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                      {broker.public_access_token.substring(0, 8)}...
                    </span>
                  ) : (
                    <span className="text-red-500">No generado</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {broker.public_access_token && broker.slug ? (
                    <div className="flex items-center">
                      <span className="truncate max-w-xs">{getQuoteUrl(broker)}</span>
                      <button
                        onClick={() => copyToClipboard(getQuoteUrl(broker), broker.name)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                        title="Copiar URL"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => generateToken(broker.id)}
                    disabled={generating[broker.id]}
                    className="text-blue-600 hover:text-blue-900 flex items-center justify-end"
                  >
                    {generating[broker.id] ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-1" />
                        <span>Generando...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        <span>{broker.public_access_token ? 'Regenerar Token' : 'Generar Token'}</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">Información</h4>
        <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
          <li>Cada broker necesita un token único para acceder al cotizador.</li>
          <li>Al generar un token, se crea automáticamente un slug basado en el nombre del broker.</li>
          <li>La URL generada es la que debes compartir con el broker para que acceda al cotizador.</li>
          <li>Si regeneras un token, la URL anterior dejará de funcionar.</li>
        </ul>
      </div>
    </div>
  );
};

export default BrokerTokenGenerator;