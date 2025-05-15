import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

interface RealEstateAgency {
  id: string;
  rut: string;
  business_name: string;
  bank: string;
  account_type: string;
  account_number: string;
}

interface RealEstateAgencyFormProps {
  agency?: RealEstateAgency | null;
  onClose: () => void;
}

const RealEstateAgencyForm: React.FC<RealEstateAgencyFormProps> = ({ agency, onClose }) => {
  const { session } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<RealEstateAgency, 'id'>>({
    rut: agency?.rut || '',
    business_name: agency?.business_name || '',
    bank: agency?.bank || '',
    account_type: agency?.account_type || '',
    account_number: agency?.account_number || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      const data = {
        ...formData,
        updated_by: session?.user.id,
      };

      if (agency?.id) {
        const { error } = await supabase
          .from('real_estate_agencies')
          .update(data)
          .eq('id', agency.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('real_estate_agencies')
          .insert([{ ...data, created_by: session?.user.id }]);

        if (error) throw error;
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onClose}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver
        </button>
        <h2 className="text-xl font-semibold text-gray-900">
          {agency ? 'Editar Inmobiliaria' : 'Nueva Inmobiliaria'}
        </h2>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
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
            <label htmlFor="bank" className="block text-sm font-medium text-gray-700">
              Banco *
            </label>
            <input
              type="text"
              id="bank"
              name="bank"
              required
              value={formData.bank}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="account_type" className="block text-sm font-medium text-gray-700">
              Tipo de Cuenta *
            </label>
            <select
              id="account_type"
              name="account_type"
              required
              value={formData.account_type}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Seleccione un tipo</option>
              <option value="Cuenta Corriente">Cuenta Corriente</option>
              <option value="Cuenta Vista">Cuenta Vista</option>
              <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
            </select>
          </div>

          <div>
            <label htmlFor="account_number" className="block text-sm font-medium text-gray-700">
              Número de Cuenta *
            </label>
            <input
              type="text"
              id="account_number"
              name="account_number"
              required
              value={formData.account_number}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
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
  );
};

export default RealEstateAgencyForm;