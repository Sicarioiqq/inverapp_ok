import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile, formatCurrency } from '../../lib/supabase'; // formatCurrency ya está aquí
import { useAuthStore } from '../../stores/authStore';
import Layout from '../../components/Layout';
import { ArrowLeft, Save, Loader2, TrendingUp, Wallet, DollarSign, TrendingDown, Minus, Gift, Info, Edit, FileText } from 'lucide-react';

// --- Definiciones de Tipos para Promociones ---
export const PROMOTION_TYPES_ARRAY = [
  'Arriendo garantizado',
  'Cashback',
  'Giftcard',
  'Bono Ejecutivo',
  'Crédito al Pie',
  'Dividendo Garantizado'
] as const;

export type PromotionType = typeof PROMOTION_TYPES_ARRAY[number];

export interface AppliedPromotion {
  id: string; 
  reservation_id: string; 
  promotion_type: PromotionType;
  is_against_discount: boolean;
  observations?: string | null;
  amount: number; 
  beneficiary: string;
  rut: string;
  bank: string;
  account_type: string;
  account_number: string;
  email: string;
  purchase_order?: string | null;
  document_number?: string | null;
  document_date?: string | null; 
  payment_date?: string | null;  
  created_at?: string;
}
// --- Fin Tipos ---

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

interface FinancialSummary {
    totalPayment: number;
    recoveryPayment: number;
    minimumPrice: number;
    difference: number;
    totalCommissionUF: number; // Comisión bruta
    firstPaymentUF: number;
    secondPaymentUF?: number;
    totalPromotionsAgainstDiscount: number; // Total de promociones que son contra descuento
}

const PaymentEdit = () => {
  const { id: reservationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const [loading, setLoading] = useState(true);
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
  
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>({
    totalPayment: 0,
    recoveryPayment: 0,
    minimumPrice: 0,
    difference: 0,
    totalCommissionUF: 0,
    firstPaymentUF: 0,
    secondPaymentUF: 0,
    totalPromotionsAgainstDiscount: 0,
  });

  const [appliedPromotions, setAppliedPromotions] = useState<AppliedPromotion[]>([]);

  useEffect(() => {
    if (reservationId) {
      setLoading(true);
      Promise.all([
        fetchReservationAndCommission(reservationId),
        fetchAppliedPromotions(reservationId)
      ]).catch((err) => {
        console.error("Error en la carga inicial:", err);
        setError(err.message || "Error al cargar datos.");
      }).finally(() => {
        setLoading(false);
      });
    } else {
        navigate('/pagos');
    }
  }, [reservationId]);

  // --- MODIFICACIÓN: useEffect para calcular Resumen Financiero, incluyendo promociones ---
  useEffect(() => {
    if (reservation && formData) { 
      const totalPaymentVal = reservation.total_payment || 0;
      const subsidyPaymentVal = reservation.subsidy_payment || 0;
      const recoveryPaymentVal = totalPaymentVal - subsidyPaymentVal;
      const minimumPriceVal = reservation.minimum_price || 0;
      const commissionAmountForCalc = formData.commission_amount || 0;

      // Calcular total de promociones que son "Contra Descuento"
      const totalPromotionsAgainstDiscountVal = appliedPromotions.reduce((sum, promo) => {
        if (promo.is_against_discount) {
          return sum + (promo.amount || 0); // Asegurarse que promo.amount es numérico
        }
        return sum;
      }, 0);
      
      // Nueva fórmula para la diferencia
      const differenceVal = recoveryPaymentVal - minimumPriceVal - commissionAmountForCalc - totalPromotionsAgainstDiscountVal;
      
      const firstPaymentUFCalc = commissionAmountForCalc * (formData.first_payment_percentage / 100);
      const secondPaymentUFCalc = formData.number_of_payments === 2 ? commissionAmountForCalc - firstPaymentUFCalc : 0;

      setFinancialSummary({
        totalPayment: totalPaymentVal,
        recoveryPayment: recoveryPaymentVal,
        minimumPrice: minimumPriceVal,
        difference: differenceVal,
        totalCommissionUF: commissionAmountForCalc,
        firstPaymentUF: firstPaymentUFCalc,
        secondPaymentUF: secondPaymentUFCalc,
        totalPromotionsAgainstDiscount: totalPromotionsAgainstDiscountVal,
      });
    }
  }, [reservation, formData, appliedPromotions]); // --- MODIFICACIÓN: Añadido appliedPromotions ---

  const fetchReservationAndCommission = async (resId: string) => {
    try {
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select(`*, project:projects(name, stage), broker:brokers(id, name, business_name), client:clients(first_name, last_name, rut)`)
        .eq('id', resId)
        .single();

      if (reservationError) throw reservationError;
      if (!reservationData) throw new Error("Reserva no encontrada");
      setReservation(reservationData);

      const { data: commissionData, error: commissionError } = await supabase
        .from('broker_commissions')
        .select('*')
        .eq('reservation_id', resId)
        .maybeSingle();

      if (commissionError && commissionError.code !== 'PGRST116') {
        throw commissionError;
      }

      if (commissionData) {
        setExistingCommissionId(commissionData.id);
        setFormData({
          commission_amount: commissionData.commission_amount || 0,
          commission_includes_tax: commissionData.commission_includes_tax !== undefined ? commissionData.commission_includes_tax : true,
          commission_for_discount: commissionData.commission_for_discount !== undefined ? commissionData.commission_for_discount : true,
          pays_secondary: commissionData.pays_secondary !== undefined ? commissionData.pays_secondary : false,
          number_of_payments: commissionData.number_of_payments || 1,
          first_payment_percentage: commissionData.first_payment_percentage || 100,
          purchase_order: commissionData.purchase_order || '',
          invoice_1: commissionData.invoice_1 || '',
          invoice_1_date: commissionData.invoice_1_date,
          payment_1_date: commissionData.payment_1_date,
          invoice_2: commissionData.invoice_2 || '',
          invoice_2_date: commissionData.invoice_2_date,
          payment_2_date: commissionData.payment_2_date,
        });

        const { data: flowData, error: flowError } = await supabase
          .from('commission_flows')
          .select('id, is_second_payment')
          .eq('broker_commission_id', commissionData.id)
          .order('is_second_payment', { ascending: true });
        if (flowError) throw flowError;
        
        if (flowData && flowData.length > 0) {
          setHasPaymentFlow(!!flowData.find(f => !f.is_second_payment));
          setHasSecondPaymentFlow(!!flowData.find(f => f.is_second_payment));
        }
      }
    } catch (err) {
        throw err; 
    }
  };

  const fetchAppliedPromotions = async (resId: string) => {
    if (!resId) return;
    try {
      const { data, error: promoError } = await supabase
        .from('promotions')
        .select('*') 
        .eq('reservation_id', resId)
        .order('created_at', { ascending: true });

      if (promoError) throw promoError;
      setAppliedPromotions((data as AppliedPromotion[]) || []);
    } catch (err: any) {
      console.error('Error fetching applied promotions:', err);
      throw err; 
    }
  };

  const netCommission = formData.commission_includes_tax ? formData.commission_amount / 1.19 : formData.commission_amount;
  // const firstPaymentAmount = formData.commission_amount * (formData.first_payment_percentage / 100); // Ya se calcula en financialSummary
  // const secondPaymentAmount = formData.commission_amount - firstPaymentAmount; // Ya se calcula en financialSummary

  const calculateBasePrice = () => {
    if (!reservation) return 0;
    if (formData.pays_secondary) return reservation.minimum_price || 0;
    return (reservation.minimum_price || 0) - (reservation.parking_price || 0) - (reservation.storage_price || 0);
  };

  const calculateCommissionPercentage = () => {
    const basePrice = calculateBasePrice();
    if (basePrice === 0) return 0;
    return (formData.commission_amount / basePrice) * 100;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'date') {
      setFormData(prev => ({ ...prev, [name]: value || null }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : (name === 'commission_amount' || name === 'first_payment_percentage')
          ? parseFloat(value) || 0 
          : (name === 'number_of_payments') 
            ? parseInt(value) as 1 | 2
            : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation?.broker?.id || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      const commissionPayload = { 
        broker_id: reservation.broker.id,
        reservation_id: reservationId, 
        commission_amount: formData.commission_amount,
        commission_includes_tax: formData.commission_includes_tax,
        commission_for_discount: formData.commission_for_discount,
        pays_secondary: formData.pays_secondary,
        number_of_payments: formData.number_of_payments,
        first_payment_percentage: formData.first_payment_percentage,
        purchase_order: formData.purchase_order || null,
        invoice_1: formData.invoice_1 || null,
        invoice_1_date: formData.invoice_1_date || null,
        payment_1_date: formData.payment_1_date || null,
        invoice_2: formData.invoice_2 || null,
        invoice_2_date: formData.invoice_2_date || null,
        payment_2_date: formData.payment_2_date || null,
        updated_by: session?.user.id,
        // NO enviar 'difference' a la tabla 'broker_commissions' a menos que exista esa columna
      };

      if (hasPaymentFlow) delete (commissionPayload as any).payment_1_date;
      if (hasSecondPaymentFlow) delete (commissionPayload as any).payment_2_date;

      let upsertError;
      if (existingCommissionId) {
        const { error } = await supabase.from('broker_commissions').update(commissionPayload).eq('id', existingCommissionId);
        upsertError = error;
      } else {
        const { error } = await supabase.from('broker_commissions').insert([{ ...commissionPayload, created_by: session?.user.id }]);
        upsertError = error;
      }
      if (upsertError) throw upsertError;
      navigate('/pagos');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) { return <Layout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div></Layout>; }
  if (error && !reservation) { return <Layout><div className="bg-red-50 text-red-600 p-4 rounded-lg">Error: {error}</div></Layout>; }
  if (!reservation && !loading) { return <Layout><div className="p-4 text-center text-gray-500">No se encontró información para esta reserva.</div></Layout>; }
  if (!reservation) { return <Layout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div></Layout>; }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate('/pagos')} className="flex items-center text-gray-600 hover:text-gray-900"><ArrowLeft className="h-5 w-5 mr-2" />Volver</button>
          <h1 className="text-2xl font-semibold text-gray-900">Editar Comisión - Reserva {reservation.reservation_number}</h1>
          <div /> 
        </div>

        {error && !submitting && (<div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">{error}</div>)}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3 flex items-center"><Info className="h-6 w-6 mr-2 text-sky-600" />Información de la Reserva</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><p className="text-gray-500">N° Reserva:</p><p className="text-gray-800 font-medium">{reservation.reservation_number}</p></div>
              <div><p className="text-gray-500">Fecha Reserva:</p><p className="text-gray-800 font-medium">{formatDateChile(reservation.reservation_date)}</p></div>
              <div><p className="text-gray-500">Proyecto:</p><p className="text-gray-800 font-medium">{reservation.project?.name} {reservation.project?.stage}</p></div>
              <div><p className="text-gray-500">Unidad:</p><p className="text-gray-800 font-medium">Depto. {reservation.apartment_number}{reservation.parking_number && ` | Est. ${reservation.parking_number}`}{reservation.storage_number && ` | Bod. ${reservation.storage_number}`}</p></div>
              <div><p className="text-gray-500">Cliente:</p><p className="text-gray-800 font-medium">{reservation.client?.first_name} {reservation.client?.last_name} ({reservation.client?.rut})</p></div>
              <div><p className="text-gray-500">Broker:</p><p className="text-gray-800 font-medium">{reservation.broker?.name} <span className="text-gray-600">({reservation.broker?.business_name})</span></p></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3 flex items-center"><DollarSign className="h-6 w-6 mr-2 text-green-600" />Detalles de la Comisión</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label htmlFor="commission_amount" className="block text-sm font-medium text-gray-700">Monto Comisión Bruta (UF) *</label>
                <input type="number" id="commission_amount" name="commission_amount" required min="0" step="0.01" value={formData.commission_amount} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/>
                <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                  <p>Comisión Neta: {formatCurrency(netCommission)} UF</p>
                  <p>% Comisión: {calculateCommissionPercentage().toFixed(2)}% (Base: {formatCurrency(calculateBasePrice())} UF)</p>
                </div>
              </div>
              <div className="space-y-3 pt-2 md:pt-6"> 
                <div className="flex items-center"><input type="checkbox" id="commission_includes_tax" name="commission_includes_tax" checked={formData.commission_includes_tax} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/><label htmlFor="commission_includes_tax" className="ml-2 block text-sm text-gray-700">Comisión incluye IVA</label></div>
                <div className="flex items-center"><input type="checkbox" id="commission_for_discount" name="commission_for_discount" checked={formData.commission_for_discount} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/><label htmlFor="commission_for_discount" className="ml-2 block text-sm text-gray-700">Comisión sobre precio con dcto.</label></div>
                <div className="flex items-center"><input type="checkbox" id="pays_secondary" name="pays_secondary" checked={formData.pays_secondary} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/><label htmlFor="pays_secondary" className="ml-2 block text-sm text-gray-700">Paga Secundarios (Est. y Bod.)</label></div>
              </div>
              <div>
                <label htmlFor="number_of_payments" className="block text-sm font-medium text-gray-700">Número de Pagos *</label>
                <select id="number_of_payments" name="number_of_payments" required value={formData.number_of_payments} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                  <option value={1}>1 pago</option><option value={2}>2 pagos</option>
                </select>
              </div>
              <div>
                <label htmlFor="first_payment_percentage" className="block text-sm font-medium text-gray-700">% Primer Pago *</label>
                <select id="first_payment_percentage" name="first_payment_percentage" required value={formData.first_payment_percentage} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                  <option value={25}>25%</option><option value={50}>50%</option><option value={100}>100%</option>
                </select>
                <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                  {/* --- MODIFICACIÓN: Usa valores de financialSummary para los montos de pago --- */}
                  <p>1er Pago: {formatCurrency(financialSummary.firstPaymentUF || 0)} UF</p>
                  {formData.number_of_payments === 2 && formData.first_payment_percentage < 100 && (
                    <p>2do Pago: {formatCurrency(financialSummary.secondPaymentUF || 0)} UF</p>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="purchase_order" className="block text-sm font-medium text-gray-700">N° OC</label>
                <input type="text" id="purchase_order" name="purchase_order" value={formData.purchase_order} onChange={(e) => setFormData(prev => ({ ...prev, purchase_order: e.target.value }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/>
              </div>
            </div>
          </div>
          
          {/* --- SECCIÓN: Promociones Aplicadas --- */}
          {reservationId && (
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <Gift className="h-6 w-6 mr-2 text-purple-600" />
                  Promociones de la Reserva
                </h2>
                 <button 
                    type="button"
                    onClick={() => navigate(`/reservas/editar/${reservationId}`)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                    title="Gestionar Promociones en la Reserva"
                >
                    <Edit className="h-4 w-4 mr-1" /> Gestionar Promociones
                </button>
              </div>
              {appliedPromotions.length > 0 ? (
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {appliedPromotions.map((promo) => (
                    <div key={promo.id} className="p-4 border border-gray-200 rounded-lg bg-slate-50 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-md text-purple-700">{promo.promotion_type}</h3>
                          <p className="text-lg font-bold text-purple-600">
                            {formatCurrency(promo.amount)} UF
                          </p>
                        </div>
                        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          promo.is_against_discount 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {promo.is_against_discount ? 'Contra Descuento' : 'No Contra Dcto.'}
                        </span>
                      </div>
                      {promo.observations && (
                        <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-100 italic">
                          {promo.observations}
                        </p>
                      )}
                       <div className="mt-2 text-xs text-gray-500 space-y-0.5 pt-2 border-t border-gray-100">
                          {promo.beneficiary && (<p><strong>Beneficiario:</strong> {promo.beneficiary}{promo.rut && ` (RUT: ${promo.rut})`}</p>)}
                          {promo.document_number && (<p><strong>Doc. Pago N°:</strong> {promo.document_number} {promo.document_date ? `(Fecha Emisión: ${formatDateChile(promo.document_date)})` : ''}</p>)}
                          {promo.payment_date && (<p><strong>Fecha Pago Promoción:</strong> {formatDateChile(promo.payment_date)}</p>)}
                        </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Esta reserva no tiene promociones aplicadas.</p>
              )}
            </div>
          )}
          {/* --- FIN SECCIÓN --- */}

          <div className="bg-white p-6 rounded-lg shadow-lg">
             <div className="flex items-center mb-4 border-b pb-3">
                <TrendingUp className="h-6 w-6 mr-2 text-indigo-600" />
                <h2 className="text-xl font-semibold text-gray-800">Resumen Financiero</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard title="Total Escrituración" value={financialSummary.totalPayment} icon={<TrendingUp />} />
              <SummaryCard title="Total Recuperación" value={financialSummary.recoveryPayment} icon={<Wallet />} />
              <SummaryCard title="Precio Mínimo" value={financialSummary.minimumPrice} icon={<DollarSign />} />
              <SummaryCard 
                title="Diferencia" 
                value={financialSummary.difference} 
                icon={
                  financialSummary.difference >= 0 ? <TrendingUp className="text-green-500" /> : <TrendingDown className="text-red-500" />
                }
                valueColor={
                  financialSummary.difference >= 0 ? 'text-green-600' : 'text-red-600'
                }
                // --- MODIFICACIÓN: Subtítulo de la tarjeta Diferencia ---
                subtitle="(Recuperación - Mínimo - Comisión Bruta - Promociones Contra Dcto.)"
              />
            </div>
            {/* --- NUEVO: Mostrar el total de promociones descontadas para transparencia --- */}
            {financialSummary.totalPromotionsAgainstDiscount > 0 && (
                <div className="mt-4 pt-3 border-t">
                    <p className="text-sm text-gray-600">
                        Total Promociones (Contra Descuento) aplicadas en Diferencia: 
                        <span className="font-semibold text-orange-600"> {formatCurrency(financialSummary.totalPromotionsAgainstDiscount)} UF</span>
                    </p>
                </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3 flex items-center"><FileText className="h-6 w-6 mr-2 text-cyan-600" />Facturación y Pagos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label htmlFor="invoice_1" className="block text-sm font-medium text-gray-700">N° Factura {formData.number_of_payments === 2 ? '1' : ''}</label><input type="text" id="invoice_1" name="invoice_1" value={formData.invoice_1} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
              <div><label htmlFor="invoice_1_date" className="block text-sm font-medium text-gray-700">Fecha Emisión {formData.number_of_payments === 2 ? '1' : ''}</label><input type="date" id="invoice_1_date" name="invoice_1_date" value={formData.invoice_1_date || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
              <div><label htmlFor="payment_1_date" className="block text-sm font-medium text-gray-700">Fecha Pago {formData.number_of_payments === 2 ? '1' : ''}</label>
                {hasPaymentFlow ? (<div className="mt-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 text-sm">{formData.payment_1_date ? formatDateChile(formData.payment_1_date) : 'No establecida'}<p className="text-xs text-gray-500">(Desde flujo de pago)</p></div>) 
                : (<input type="date" id="payment_1_date" name="payment_1_date" value={formData.payment_1_date || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/>)}
              </div>
              {formData.number_of_payments === 2 && (
                <>
                  <div><label htmlFor="invoice_2" className="block text-sm font-medium text-gray-700">N° Factura 2</label><input type="text" id="invoice_2" name="invoice_2" value={formData.invoice_2} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                  <div><label htmlFor="invoice_2_date" className="block text-sm font-medium text-gray-700">Fecha Emisión 2</label><input type="date" id="invoice_2_date" name="invoice_2_date" value={formData.invoice_2_date || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/></div>
                  <div><label htmlFor="payment_2_date" className="block text-sm font-medium text-gray-700">Fecha Pago 2</label>
                    {hasSecondPaymentFlow ? (<div className="mt-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 text-sm">{formData.payment_2_date ? formatDateChile(formData.payment_2_date) : 'No establecida'}<p className="text-xs text-gray-500">(Desde flujo de segundo pago)</p></div>) 
                    : (<input type="date" id="payment_2_date" name="payment_2_date" value={formData.payment_2_date || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"/>)}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={submitting} className="flex items-center px-6 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
              {submitting ? (<><Loader2 className="animate-spin h-5 w-5 mr-2" />Guardando...</>) : (<><Save className="h-5 w-5 mr-2" />Guardar Cambios</>)}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  valueColor?: string;
  subtitle?: string;
}
const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, valueColor = 'text-gray-900', subtitle }) => (
  <div className={`p-4 rounded-lg shadow ${valueColor.includes('red') ? 'bg-red-50' : valueColor.includes('green') ? 'bg-green-50' : 'bg-gray-50'}`}>
    <div className="flex items-center mb-1">
      <span className="text-gray-500 mr-2">{icon}</span>
      <h3 className="text-sm font-medium text-gray-700">{title}</h3>
    </div>
    <div className={`text-xl font-bold ${valueColor}`}>
      {formatCurrency(value)} UF
    </div>
    {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
  </div>
);

export default PaymentEdit;