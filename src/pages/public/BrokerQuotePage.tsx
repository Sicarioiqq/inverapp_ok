import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { AlertTriangle } from 'lucide-react';
import BrokerQuotePDF from '../../components/pdf/BrokerQuotePDF';
import { supabase } from '../../lib/supabase';

const BrokerQuotePage = () => {
  const { token } = useParams();
  const [broker, setBroker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBroker = async () => {
      try {
        const { data, error } = await supabase
          .from('brokers')
          .select('*')
          .eq('public_access_token', token)
          .single();

        if (error) throw error;
        setBroker(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchBroker();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !broker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <p>No se pudo cargar el cotizador. Token inválido o expirado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        {broker && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">
                  Cotizador {broker.name}
                </h1>
              </div>

              {/* Add your quote form components here */}
              {/* This is a placeholder for the actual quote form implementation */}
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-gray-600">
                  Implementa aquí el formulario de cotización
                </p>
              </div>

              {/* PDF Download section */}
              <div className="mt-6">
                {broker ? (
                  <PDFDownloadLink
                    document={<BrokerQuotePDF broker={broker} />}
                    fileName={`cotizacion-${broker.name.toLowerCase()}.pdf`}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {({ loading }) =>
                      loading ? 'Generando PDF...' : 'Descargar Cotización'
                    }
                  </PDFDownloadLink>
                ) : (
                  <div className="p-2 bg-yellow-50 text-yellow-600 rounded-md text-sm">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      <span>
                        Complete los datos del cliente y asegúrese que la forma de pago coincida con el precio total.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BrokerQuotePage;