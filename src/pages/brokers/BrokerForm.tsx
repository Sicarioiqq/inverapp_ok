import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import Layout from '../../components/Layout';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

interface BrokerFormData {
  rut: string;
  name: string;
  business_name: string;
  legal_representative: string;
  legal_representative_rut: string;
  commercial_address: string;
  commercial_address_commune: string;
  commercial_contact_name: string;
  commercial_contact_phone: string;
  commercial_contact_email: string;
  constitution_date: string;
  constitution_notary: string;
  operations_contact_name: string;
  operations_contact_phone: string;
  operations_contact_email: string;
  finance_contact_name: string;
  finance_contact_phone: string;
  finance_contact_email: string;
  kam_name: string;
  kam_phone: string;
  kam_email: string;
  kam_receives_commission: boolean;
}

const BrokerForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { session } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<BrokerFormData>({
    rut: '',
    name: '',
    business_name: '',
    legal_representative: '',
    legal_representative_rut: '',
    commercial_address: '',
    commercial_address_commune: '',
    commercial_contact_name: '',
    commercial_contact_phone: '',
    commercial_contact_email: '',
    constitution_date: '',
    constitution_notary: '',
    operations_contact_name: '',
    operations_contact_phone: '',
    operations_contact_email: '',
    finance_contact_name: '',
    finance_contact_phone: '',
    finance_contact_email: '',
    kam_name: '',
    kam_phone: '',
    kam_email: '',
    kam_receives_commission: false,
  });

  useEffect(() => {
    if (id) {
      fetchBroker();
    }
  }, [id]);

  const fetchBroker = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('brokers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          ...data,
          constitution_date: data.constitution_date.split('T')[0],
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      const brokerData = {
        ...formData,
        updated_by: session?.user.id,
      };

      if (id) {
        const { error } = await supabase
          .from('brokers')
          .update(brokerData)
          .eq('id', id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('brokers')
          .insert([{ ...brokerData, created_by: session?.user.id }]);

        if (error) throw error;
      }

      navigate('/brokers');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/brokers')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Volver
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            {id ? 'Editar Broker' : 'Nuevo Broker'}
          </h1>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información General */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Información General
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="rut" className="block text-sm font-medium text-gray-700">
                  RUT *
                </label>
                <input
                  type="text"
                  id="rut"
                  name="rut"
                  required
                  value={formData.rut}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Nombre *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="business_name" className="block text-sm font-medium text-gray-700">
                  Razón Social *
                </label>
                <input
                  type="text"
                  id="business_name"
                  name="business_name"
                  required
                  value={formData.business_name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="constitution_date" className="block text-sm font-medium text-gray-700">
                  Fecha Escritura Constitución *
                </label>
                <input
                  type="date"
                  id="constitution_date"
                  name="constitution_date"
                  required
                  value={formData.constitution_date}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="constitution_notary" className="block text-sm font-medium text-gray-700">
                  Notaría Constitución *
                </label>
                <input
                  type="text"
                  id="constitution_notary"
                  name="constitution_notary"
                  required
                  value={formData.constitution_notary}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Representante Legal */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Representante Legal
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="legal_representative" className="block text-sm font-medium text-gray-700">
                  Nombre *
                </label>
                <input
                  type="text"
                  id="legal_representative"
                  name="legal_representative"
                  required
                  value={formData.legal_representative}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="legal_representative_rut" className="block text-sm font-medium text-gray-700">
                  RUT *
                </label>
                <input
                  type="text"
                  id="legal_representative_rut"
                  name="legal_representative_rut"
                  required
                  value={formData.legal_representative_rut}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Dirección Comercial */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Dirección Comercial
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="commercial_address" className="block text-sm font-medium text-gray-700">
                  Dirección *
                </label>
                <input
                  type="text"
                  id="commercial_address"
                  name="commercial_address"
                  required
                  value={formData.commercial_address}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="commercial_address_commune" className="block text-sm font-medium text-gray-700">
                  Comuna *
                </label>
                <input
                  type="text"
                  id="commercial_address_commune"
                  name="commercial_address_commune"
                  required
                  value={formData.commercial_address_commune}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Contacto Comercial */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Contacto Comercial
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="commercial_contact_name" className="block text-sm font-medium text-gray-700">
                  Nombre *
                </label>
                <input
                  type="text"
                  id="commercial_contact_name"
                  name="commercial_contact_name"
                  required
                  value={formData.commercial_contact_name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="commercial_contact_phone" className="block text-sm font-medium text-gray-700">
                  Teléfono
                </label>
                <input
                  type="text"
                  id="commercial_contact_phone"
                  name="commercial_contact_phone"
                  value={formData.commercial_contact_phone}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="commercial_contact_email" className="block text-sm font-medium text-gray-700">
                  Correo
                </label>
                <input
                  type="email"
                  id="commercial_contact_email"
                  name="commercial_contact_email"
                  value={formData.commercial_contact_email}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Contacto Operaciones */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Contacto Operaciones
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="operations_contact_name" className="block text-sm font-medium text-gray-700">
                  Nombre
                </label>
                <input
                  type="text"
                  id="operations_contact_name"
                  name="operations_contact_name"
                  value={formData.operations_contact_name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="operations_contact_phone" className="block text-sm font-medium text-gray-700">
                  Teléfono
                </label>
                <input
                  type="text"
                  id="operations_contact_phone"
                  name="operations_contact_phone"
                  value={formData.operations_contact_phone}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="operations_contact_email" className="block text-sm font-medium text-gray-700">
                  Correo
                </label>
                <input
                  type="email"
                  id="operations_contact_email"
                  name="operations_contact_email"
                  value={formData.operations_contact_email}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Contacto Finanzas */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Contacto Finanzas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="finance_contact_name" className="block text-sm font-medium text-gray-700">
                  Nombre
                </label>
                <input
                  type="text"
                  id="finance_contact_name"
                  name="finance_contact_name"
                  value={formData.finance_contact_name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="finance_contact_phone" className="block text-sm font-medium text-gray-700">
                  Teléfono
                </label>
                <input
                  type="text"
                  id="finance_contact_phone"
                  name="finance_contact_phone"
                  value={formData.finance_contact_phone}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="finance_contact_email" className="block text-sm font-medium text-gray-700">
                  Correo
                </label>
                <input
                  type="email"
                  id="finance_contact_email"
                  name="finance_contact_email"
                  value={formData.finance_contact_email}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* KAM */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Key Account Manager (KAM)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="kam_name" className="block text-sm font-medium text-gray-700">
                  Nombre *
                </label>
                <input
                  type="text"
                  id="kam_name"
                  name="kam_name"
                  required
                  value={formData.kam_name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="kam_phone" className="block text-sm font-medium text-gray-700">
                  Teléfono
                </label>
                <input
                  type="text"
                  id="kam_phone"
                  name="kam_phone"
                  value={formData.kam_phone}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="kam_email" className="block text-sm font-medium text-gray-700">
                  Correo
                </label>
                <input
                  type="email"
                  id="kam_email"
                  name="kam_email"
                  value={formData.kam_email}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="kam_receives_commission"
                    name="kam_receives_commission"
                    checked={formData.kam_receives_commission}
                    onChange={(e) => setFormData(prev => ({ ...prev, kam_receives_commission: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="kam_receives_commission" className="ml-2 block text-sm text-gray-700">
                    KAM puede recibir comisiones
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default BrokerForm;