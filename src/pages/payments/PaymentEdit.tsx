import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import Layout from '../../components/Layout';
import { ArrowLeft, Save, Loader2, TrendingUp, Wallet, DollarSign, TrendingDown, Minus } from 'lucide-react';

interface RealEstateAgency {
  id: string;
  business_name: string;
}

interface Project {
  id: string;
  name: string;
  stage: string;
  commune: string;
  deadline: string;
  installments: number;
  real_estate_agency_id: string;
  logo_url: string | null;
}

interface CommissionFormData {
  commission_amount: number;
  commission_includes_tax: boolean;
  commission_for_discount: boolean;
  pays_secondary: boolean;
  number_of_payments: 1 | 2;
  first_payment_percentage: 25 | 50 | 100;
  purchase_order: string;
  invoice_1: string;
  invoice_1_date: string | null;
  payment_1_date: string | null;
  invoice_2: string;
  invoice_2_date: string | null;
  payment_2_date: string | null;
}

interface ProjectFormProps {
  project?: Project | null;
  onClose: () => void;
}

const PaymentEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<any | null>(null);
  const [existingCommissionId, setExistingCommissionId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CommissionFormData>({
    commission_amount: 0,
    commission_includes_tax: true,
    commission_for_discount: true,
    pays_secondary: false,
    number_of_payments: 1,
    first_payment_percentage: 100,
    purchase_order: '',
    invoice_1: '',
    invoice_1_date: null,
    payment_1_date: null,
    invoice_2: '',
    invoice_2_date: null,
    payment_2_date: null,
  });
  const [hasPaymentFlow, setHasPaymentFlow] = useState(false);
  const [hasSecondPaymentFlow, setHasSecondPaymentFlow] = useState(false);
  const [financialSummary, setFinancialSummary] = useState({
    totalPayment: 0,
    recoveryPayment: 0,
    minimumPrice: 0,
    difference: 0
  });

  useEffect(() => {
    if (id) {
      fetchReservation();
    }
  }, [id]);

  useEffect(() => {
    if (reservation) {
      // Calculate financial summary
      const totalPayment = reservation.total_payment || 0;
      const subsidyPayment = reservation.subsidy_payment || 0;
      const recoveryPayment = totalPayment - subsidyPayment;
      const minimumPrice = reservation.minimum_price || 0;
      const difference = recoveryPayment - minimumPrice - formData.commission_amount;

      setFinancialSummary({
        totalPayment,
        recoveryPayment,
        minimumPrice,
        difference
      });
    }
  }, [reservation, formData.commission_amount]);

  const fetchReservation = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select(`
          *,
          project:projects(name, stage),
          broker:brokers(id, name, business_name),
          client:clients(first_name, last_name, rut)
        `)
        .eq('id', id)
        .single();

      if (reservationError) throw reservationError;

      if (reservationData) {
        setReservation(reservationData);

        // Fetch existing commission data if it exists
        const { data: commissionData, error: commissionError } = await supabase
          .from('broker_commissions')
          .select('*')
          .eq('reservation_id', id)
          .single();

        if (commissionError && commissionError.code !== 'PGRST116') {
          throw commissionError;
        }

        if (commissionData) {
          setExistingCommissionId(commissionData.id);
          setFormData({
            commission_amount: commissionData.commission_amount || 0,
            commission_includes_tax: commissionData.commission_includes_tax,
            commission_for_discount: commissionData.commission_for_discount,
            pays_secondary: commissionData.pays_secondary,
            number_of_payments: commissionData.number_of_payments,
            first_payment_percentage: commissionData.first_payment_percentage,
            purchase_order: commissionData.purchase_order || '',
            invoice_1: commissionData.invoice_1 || '',
            invoice_1_date: commissionData.invoice_1_date,
            payment_1_date: commissionData.payment_1_date,
            invoice_2: commissionData.invoice_2 || '',
            invoice_2_date: commissionData.invoice_2_date,
            payment_2_date: commissionData.payment_2_date,
          });

          // Check if there's a payment flow for this commission
          const { data: flowData, error: flowError } = await supabase
            .from('commission_flows')
            .select('id, is_second_payment')
            .eq('broker_commission_id', commissionData.id)
            .order('is_second_payment', { ascending: true });

          if (flowError) throw flowError;
          
          if (flowData && flowData.length > 0) {
            // Check for first payment flow
            const firstPaymentFlow = flowData.find(flow => !flow.is_second_payment);
            setHasPaymentFlow(!!firstPaymentFlow);
            
            // Check for second payment flow
            const secondPaymentFlow = flowData.find(flow => flow.is_second_payment);
            setHasSecondPaymentFlow(!!secondPaymentFlow);
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
    
    // Handle date fields specifically
    if (type === 'date') {
      setFormData(prev => ({
        ...prev,
        [name]: value || null // Set to null if value is empty string
      }));
      return;
    }

    // Handle other field types
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
    
    if (!reservation?.broker?.id || submitting) return;
    
    try {
      setSubmitting(true);
      setError(null);

      const commissionData = {
        broker_id: reservation.broker.id,
        ...formData,
        // Ensure date fields are either valid dates or null
        invoice_1_date: formData.invoice_1_date || null,
        payment_1_date: formData.payment_1_date || null,
        invoice_2_date: formData.invoice_2_date || null,
        payment_2_date: formData.payment_2_date || null,
        updated_by: session?.user.id,
        difference: financialSummary.difference
      };

      // Si hay un flujo de pago, no actualizar payment_1_date
      if (hasPaymentFlow) {
        delete commissionData.payment_1_date;
      }
      
      // Si hay un flujo de segundo pago, no actualizar payment_2_date
      if (hasSecondPaymentFlow) {
        delete commissionData.payment_2_date;
      }

      let error;

      if (existingCommissionId) {
        // Update existing commission
        const result = await supabase
          .from('broker_commissions')
          .update(commissionData)
          .eq('id', existingCommissionId);
        error = result.error;
      } else {
        // Insert new commission
        const result = await supabase
          .from('broker_commissions')
          .insert([{
            ...commissionData,
            reservation_id: id,
            created_by: session?.user.id
          }]);
        error = result.error;
      }

      if (error) throw error;

      navigate('/pagos');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!reservation) {
    return (
      <Layout>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          Reserva no encontrada
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/pagos')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Volver
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            {id ? 'Editar Comisión' : 'Nueva Comisión'}
          </h1>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información de la Reserva */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Información de la Reserva
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  N° Reserva
                </label>
                <div className="mt-1 text-gray-900">
                  {reservation.reservation_number}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fecha Reserva
                </label>
                <div className="mt-1 text-gray-900">
                  {new Date(reservation.reservation_date).toLocaleDateString()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Proyecto
                </label>
                <div className="mt-1 text-gray-900">
                  {reservation.project?.name} {reservation.project?.stage}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Unidad
                </label>
                <div className="mt-1 text-gray-900">
                  Depto. {reservation.apartment_number}
                  {reservation.parking_number && ` | Est. ${reservation.parking_number}`}
                  {reservation.storage_number && ` | Bod. ${reservation.storage_number}`}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Cliente
                </label>
                <div className="mt-1 text-gray-900">
                  {reservation.client?.first_name} {reservation.client?.last_name}
                  <div className="text-sm text-gray-500">
                    {reservation.client?.rut}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Broker
                </label>
                <div className="mt-1 text-gray-900">
                  {reservation.broker?.name}
                  <div className="text-sm text-gray-500">
                    {reservation.broker?.business_name}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comisión */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Comisión
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    Porcentaje de comisión: {formatCurrency(calculateCommissionPercentage())}%
                  </p>
                  <p className="text-sm text-gray-500">
                    Base para comisión: {formatCurrency(calculateBasePrice())} UF
                  </p>
                </div>
              </div>

              <div className="space-y-4">
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

              <div>
                <label htmlFor="purchase_order" className="block text-sm font-medium text-gray-700">
                  N° OC
                </label>
                <input
                  type="text"
                  id="purchase_order"
                  name="purchase_order"
                  value={formData.purchase_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchase_order: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Resumen Financiero */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <TrendingUp className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Resumen Financiero
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <TrendingUp className="h-5 w-5 text-gray-500 mr-2" />
                  <h3 className="text-sm font-medium text-gray-700">Total Escrituración</h3>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(financialSummary.totalPayment)} UF
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Wallet className="h-5 w-5 text-gray-500 mr-2" />
                  <h3 className="text-sm font-medium text-gray-700">Total Recuperación</h3>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(financialSummary.recoveryPayment)} UF
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <DollarSign className="h-5 w-5 text-gray-500 mr-2" />
                  <h3 className="text-sm font-medium text-gray-700">Precio Mínimo</h3>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrency(financialSummary.minimumPrice)} UF
                </div>
              </div>
              
              <div className={`p-4 rounded-lg ${financialSummary.difference >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center mb-2">
                  {financialSummary.difference >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
                  ) : financialSummary.difference < 0 ? (
                    <TrendingDown className="h-5 w-5 text-red-500 mr-2" />
                  ) : (
                    <Minus className="h-5 w-5 text-gray-500 mr-2" />
                  )}
                  <h3 className="text-sm font-medium text-gray-700">Diferencia</h3>
                </div>
                <div className={`text-xl font-bold ${
                  financialSummary.difference > 0 
                    ? 'text-green-600' 
                    : financialSummary.difference < 0 
                      ? 'text-red-600' 
                      : 'text-gray-900'
                }`}>
                  {formatCurrency(financialSummary.difference)} UF
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  (Recuperación - Mínimo - Comisión)
                </div>
              </div>
            </div>
          </div>

          {/* Facturación */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Facturación
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Primer Pago */}
              <div>
                <label htmlFor="invoice_1" className="block text-sm font-medium text-gray-700">
                  N° Factura {formData.number_of_payments === 2 ? '1' : ''}
                </label>
                <input
                  type="text"
                  id="invoice_1"
                  name="invoice_1"
                  value={formData.invoice_1}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="invoice_1_date" className="block text-sm font-medium text-gray-700">
                  Fecha de Emisión {formData.number_of_payments === 2 ? '1' : ''}
                </label>
                <input
                  type="date"
                  id="invoice_1_date"
                  name="invoice_1_date"
                  value={formData.invoice_1_date || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="payment_1_date" className="block text-sm font-medium text-gray-700">
                  Fecha de Pago {formData.number_of_payments === 2 ? '1' : ''}
                </label>
                {hasPaymentFlow ? (
                  <div className="mt-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                    {formData.payment_1_date ? new Date(formData.payment_1_date).toLocaleDateString() : 'No establecida'}
                    <p className="text-xs text-gray-500 mt-1">
                      (Establecida desde el flujo de pago)
                    </p>
                  </div>
                ) : (
                  <input
                    type="date"
                    id="payment_1_date"
                    name="payment_1_date"
                    value={formData.payment_1_date || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Segundo Pago */}
              {formData.number_of_payments === 2 && (
                <>
                  <div>
                    <label htmlFor="invoice_2" className="block text-sm font-medium text-gray-700">
                      N° Factura 2
                    </label>
                    <input
                      type="text"
                      id="invoice_2"
                      name="invoice_2"
                      value={formData.invoice_2}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="invoice_2_date" className="block text-sm font-medium text-gray-700">
                      Fecha de Emisión 2
                    </label>
                    <input
                      type="date"
                      id="invoice_2_date"
                      name="invoice_2_date"
                      value={formData.invoice_2_date || ''}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="payment_2_date" className="block text-sm font-medium text-gray-700">
                      Fecha de Pago 2
                    </label>
                    {hasSecondPaymentFlow ? (
                      <div className="mt-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                        {formData.payment_2_date ? new Date(formData.payment_2_date).toLocaleDateString() : 'No establecida'}
                        <p className="text-xs text-gray-500 mt-1">
                          (Establecida desde el flujo de segundo pago)
                        </p>
                      </div>
                    ) : (
                      <input
                        type="date"
                        id="payment_2_date"
                        name="payment_2_date"
                        value={formData.payment_2_date || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {submitting ? (
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

export default PaymentEdit;