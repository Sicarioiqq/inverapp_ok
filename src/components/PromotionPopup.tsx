import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { usePopup } from '../contexts/PopupContext';
import { Loader2 } from 'lucide-react';

interface PromotionPopupProps {
  reservationId: string;
  onSave: () => void;
  onClose: () => void;
}

interface PromotionFormData {
  amount: number;
  beneficiary: string;
  rut: string;
  bank: string;
  account_type: string;
  account_number: string;
  email: string;
  purchase_order: string;
  document_number: string;
  document_date: string;
  payment_date: string;
}

const ACCOUNT_TYPES = [
  'Cuenta Corriente',
  'Cuenta Vista',
  'Cuenta de Ahorro'
];

const PromotionPopup: React.FC<PromotionPopupProps> = ({
  reservationId,
  onSave,
  onClose
}) => {
  const { session } = useAuthStore();
  const { hidePopup } = usePopup();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromotionFormData>({
    amount: 0,
    beneficiary: '',
    rut: '',
    bank: '',
    account_type: '',
    account_number: '',
    email: '',
    purchase_order: '',
    document_number: '',
    document_date: '',
    payment_date: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase
        .from('promotions')
        .insert([{
          reservation_id: reservationId,
          ...formData,
          created_by: session?.user.id,
          updated_by: session?.user.id
        }]);

      if (error) throw error;

      hidePopup();
      onSave();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monto */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Monto (UF) *
          </label>
          <div className="mt-1">
            <input
              type="number"
              id="amount"
              name="amount"
              required
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={handleChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Monto en UF: {formatCurrency(formData.amount)} UF
          </p>
        </div>

        {/* Beneficiario */}
        <div>
          <label htmlFor="beneficiary" className="block text-sm font-medium text-gray-700">
            Beneficiario *
          </label>
          <input
            type="text"
            id="beneficiary"
            name="beneficiary"
            required
            value={formData.beneficiary}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* RUT */}
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

        {/* Banco */}
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

        {/* Tipo de Cuenta */}
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
            {ACCOUNT_TYPES.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Número de Cuenta */}
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

        {/* Correo */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Correo Electrónico *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* OC */}
        <div>
          <label htmlFor="purchase_order" className="block text-sm font-medium text-gray-700">
            N° OC
          </label>
          <input
            type="text"
            id="purchase_order"
            name="purchase_order"
            value={formData.purchase_order}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* N° Documento */}
        <div>
          <label htmlFor="document_number" className="block text-sm font-medium text-gray-700">
            N° Documento
          </label>
          <input
            type="text"
            id="document_number"
            name="document_number"
            value={formData.document_number}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Fecha de Emisión */}
        <div>
          <label htmlFor="document_date" className="block text-sm font-medium text-gray-700">
            Fecha de Emisión
          </label>
          <input
            type="date"
            id="document_date"
            name="document_date"
            value={formData.document_date}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Fecha de Pago */}
        <div>
          <label htmlFor="payment_date" className="block text-sm font-medium text-gray-700">
            Fecha de Pago
          </label>
          <input
            type="date"
            id="payment_date"
            name="payment_date"
            value={formData.payment_date}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancelar
        </button>
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
            'Guardar'
          )}
        </button>
      </div>
    </form>
  );
};

export default PromotionPopup;