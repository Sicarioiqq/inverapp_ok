import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { usePopup } from '../contexts/PopupContext';
import { Loader2 } from 'lucide-react';

interface Reservation {
  id: string;
  apartment_price: number;
  parking_price: number;
  storage_price: number;
  column_discount: number;
  additional_discount: number;
  other_discount: number;
  total_price: number;
  minimum_price: number;
}

interface BrokerCommissionPopupProps {
  reservationId: string;
  brokerId: string;
  onSave: () => void;
  onClose: () => void;
}

interface CommissionFormData {
  commission_amount: number;
  commission_includes_tax: boolean;
  commission_for_discount: boolean;
  pays_secondary: boolean;
  number_of_payments: 1 | 2;
  first_payment_percentage: 25 | 50 | 100;
}

const BrokerCommissionPopup: React.FC<BrokerCommissionPopupProps> = ({
  reservationId,
  brokerId,
  onSave,
  onClose
}) => {
  const { session } = useAuthStore();
  const { hidePopup } = usePopup();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [formData, setFormData] = useState<CommissionFormData>({
    commission_amount: 0,
    commission_includes_tax: true,
    commission_for_discount: true,
    pays_secondary: false,
    number_of_payments: 1,
    first_payment_percentage: 100
  });

  useEffect(() => {
    fetchReservation();
  }, []);

  const fetchReservation = async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (error) throw error;
      setReservation(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Calcular comisión neta (sin IVA)
  const netCommission = formData.commission_includes_tax
    ? formData.commission_amount / 1.19
    : formData.commission_amount;

  // Calcular montos de los pagos (sobre monto comisión bruto)
  const firstPaymentAmount = formData.commission_amount * (formData.first_payment_percentage / 100);
  const secondPaymentAmount = formData.commission_amount - firstPaymentAmount;

  // Calcular precio base para comisión
  const calculateBasePrice = () => {
    if (!reservation) return 0;

    if (formData.pays_secondary) {
      return reservation.minimum_price;
    }
    return reservation.minimum_price - reservation.parking_price - reservation.storage_price;
  };

  // Calcular porcentaje de comisión
  const calculateCommissionPercentage = () => {
    const basePrice = calculateBasePrice();
    if (basePrice === 0) return 0;
    return (formData.commission_amount / basePrice) * 100;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : type === 'number' 
          ? parseFloat(value) || 0 
          : parseInt(value) || value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase
        .from('broker_commissions')
        .insert([{
          reservation_id: reservationId,
          broker_id: brokerId,
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

  const handleCancel = () => {
    hidePopup();
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value / 100);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Columna izquierda */}
        <div className="space-y-4">
          <div>
            <label htmlFor="commission_amount" className="block text-sm font-medium text-gray-700">
              Monto Comisión *
            </label>
            <div className="mt-1">
              <input
                type="number"
                id="commission_amount"
                name="commission_amount"
                required
                min="0"
                step="0.01"
                value={formData.commission_amount}
                onChange={handleChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-500">
                Comisión neta (sin IVA): {formatCurrency(netCommission)} UF
              </p>
              <p className="text-sm text-gray-500">
                Porcentaje de comisión: {formatPercentage(calculateCommissionPercentage())}
              </p>
              <p className="text-sm text-gray-500">
                Base para comisión: {formatCurrency(calculateBasePrice())} UF
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="commission_includes_tax"
                name="commission_includes_tax"
                checked={formData.commission_includes_tax}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="commission_includes_tax" className="ml-2 block text-sm text-gray-700">
                Comisión incluye IVA
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="commission_for_discount"
                name="commission_for_discount"
                checked={formData.commission_for_discount}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="commission_for_discount" className="ml-2 block text-sm text-gray-700">
                Comisión sobre precio con descuento
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="pays_secondary"
                name="pays_secondary"
                checked={formData.pays_secondary}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="pays_secondary" className="ml-2 block text-sm text-gray-700">
                Paga secundarios
              </label>
            </div>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          <div>
            <label htmlFor="number_of_payments" className="block text-sm font-medium text-gray-700">
              Número de Pagos *
            </label>
            <select
              id="number_of_payments"
              name="number_of_payments"
              required
              value={formData.number_of_payments}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value={1}>1 pago</option>
              <option value={2}>2 pagos</option>
            </select>
          </div>

          <div>
            <label htmlFor="first_payment_percentage" className="block text-sm font-medium text-gray-700">
              Porcentaje Primer Pago *
            </label>
            <select
              id="first_payment_percentage"
              name="first_payment_percentage"
              required
              value={formData.first_payment_percentage}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value={25}>25%</option>
              <option value={50}>50%</option>
              <option value={100}>100%</option>
            </select>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-500">
                Primer pago: {formatCurrency(firstPaymentAmount)} UF ({formData.first_payment_percentage}%)
              </p>
              {formData.first_payment_percentage < 100 && (
                <p className="text-sm text-gray-500">
                  Segundo pago: {formatCurrency(secondPaymentAmount)} UF ({100 - formData.first_payment_percentage}%)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={handleCancel}
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

export default BrokerCommissionPopup;