import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Layout from '../../components/Layout';
import { 
  Search, 
  Edit2,
  Loader2,
  Plus
} from 'lucide-react';

interface Payment {
  id: string;
  reservation_number: string;
  project: {
    name: string;
    stage: string;
  };
  apartment_number: string;
  broker: {
    name: string;
  };
  broker_commission: {
    id: string;
    commission_amount: number;
    commission_includes_tax: boolean;
    net_commission: number;
    number_of_payments: number;
    first_payment_percentage: number;
    payment_1_date: string | null;
    payment_2_date: string | null;
    commission_flow?: {
      id: string;
      status: string;
      is_second_payment: boolean;
    }[];
  } | null;
}

const PaymentList = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim()) {
        handleSearch();
      } else {
        fetchPayments();
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          reservation_number,
          apartment_number,
          project:projects(name, stage),
          broker:brokers(id, name),
          broker_commission:broker_commissions(
            id,
            commission_amount,
            commission_includes_tax,
            net_commission,
            number_of_payments,
            first_payment_percentage,
            payment_1_date,
            payment_2_date,
            commission_flow:commission_flows(
              id,
              status,
              is_second_payment
            )
          )
        `)
        .eq('is_with_broker', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          reservation_number,
          apartment_number,
          project:projects(name, stage),
          broker:brokers(id, name),
          broker_commission:broker_commissions(
            id,
            commission_amount,
            commission_includes_tax,
            net_commission,
            number_of_payments,
            first_payment_percentage,
            payment_1_date,
            payment_2_date,
            commission_flow:commission_flows(
              id,
              status,
              is_second_payment
            )
          )
        `)
        .eq('is_with_broker', true)
        .ilike('apartment_number', `%${searchTerm}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (payment: Payment) => {
    if (!payment.broker_commission) {
      setError('Esta reserva no tiene una comisión configurada');
      return;
    }

    try {
      // Check if a flow already exists
      const { data: existingFlow, error: checkError } = await supabase
        .from('commission_flows')
        .select('id')
        .eq('broker_commission_id', payment.broker_commission.id)
        .eq('is_second_payment', false)
        .maybeSingle();

      if (checkError) throw checkError;

      // If flow exists, navigate to it
      if (existingFlow) {
        navigate(`/pagos/flujo/${existingFlow.id}`);
        return;
      }

      // Get the default flow ID and first stage
      const { data: flowData, error: flowError } = await supabase
        .from('payment_flows')
        .select('id, stages:payment_flow_stages(id)')
        .eq('name', 'Flujo de Pago Principal')
        .single();

      if (flowError) throw flowError;

      // Create new payment flow
      const { data: newFlow, error: createError } = await supabase
        .from('commission_flows')
        .insert({
          broker_commission_id: payment.broker_commission.id,
          flow_id: flowData.id,
          current_stage_id: flowData.stages[0].id,
          status: 'pending',
          started_at: null,
          is_second_payment: false
        })
        .select()
        .single();

      if (createError) throw createError;

      // Navigate to the new flow
      navigate(`/pagos/flujo/${newFlow.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateSecondPaymentFlow = async (payment: Payment, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!payment.broker_commission) {
      setError('Esta reserva no tiene una comisión configurada');
      return;
    }
    
    if (payment.broker_commission.number_of_payments !== 2) {
      setError('Esta comisión no está configurada para dos pagos');
      return;
    }
    
    try {
      // Check if a second payment flow already exists
      const { data: existingFlow, error: checkError } = await supabase
        .from('commission_flows')
        .select('id')
        .eq('broker_commission_id', payment.broker_commission.id)
        .eq('is_second_payment', true)
        .maybeSingle();

      if (checkError) throw checkError;

      // If flow exists, navigate to it
      if (existingFlow) {
        navigate(`/pagos/flujo/${existingFlow.id}`);
        return;
      }

      // Check if first payment flow is completed
      const { data: firstFlow, error: firstFlowError } = await supabase
        .from('commission_flows')
        .select('status')
        .eq('broker_commission_id', payment.broker_commission.id)
        .eq('is_second_payment', false)
        .single();

      if (firstFlowError) throw firstFlowError;
      
      if (firstFlow.status !== 'completed') {
        setError('El primer pago debe estar completado antes de crear el segundo pago');
        return;
      }

      // Get the second payment flow ID and first stage
      const { data: flowData, error: flowError } = await supabase
        .from('payment_flows')
        .select('id, stages:payment_flow_stages(id)')
        .eq('name', 'Flujo de Segundo Pago')
        .single();

      if (flowError) throw flowError;

      // Create new second payment flow
      const { data: newFlow, error: createError } = await supabase
        .from('commission_flows')
        .insert({
          broker_commission_id: payment.broker_commission.id,
          flow_id: flowData.id,
          current_stage_id: flowData.stages[0].id,
          status: 'pending',
          started_at: null,
          is_second_payment: true
        })
        .select()
        .single();

      if (createError) throw createError;

      // Navigate to the new flow
      navigate(`/pagos/flujo/${newFlow.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getPaymentStatus = (payment: Payment) => {
    if (!payment.broker_commission?.commission_flow?.length) {
      return null;
    }
    
    const firstPaymentFlow = payment.broker_commission.commission_flow.find(flow => !flow.is_second_payment);
    const secondPaymentFlow = payment.broker_commission.commission_flow.find(flow => flow.is_second_payment);
    
    // Check if payment_2_date exists to determine if second payment is completed
    const secondPaymentCompleted = payment.broker_commission.payment_2_date !== null;
    
    const firstPaymentStatus = firstPaymentFlow?.status || null;
    const secondPaymentStatus = secondPaymentFlow?.status || (secondPaymentCompleted ? 'completed' : null);
    
    return { firstPaymentStatus, secondPaymentStatus };
  };

  const canCreateSecondPayment = (payment: Payment) => {
    if (!payment.broker_commission) return false;
    
    // Must be configured for 2 payments
    if (payment.broker_commission.number_of_payments !== 2) return false;
    
    // Check if first payment flow exists and is completed
    const firstPaymentFlow = payment.broker_commission.commission_flow?.find(flow => !flow.is_second_payment);
    if (!firstPaymentFlow || firstPaymentFlow.status !== 'completed') return false;
    
    // Check if second payment flow already exists
    const secondPaymentFlow = payment.broker_commission.commission_flow?.find(flow => flow.is_second_payment);
    return !secondPaymentFlow;
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Pagos</h1>
        <div className="relative max-w-lg flex-1 ml-8">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por N° Departamento..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  N° Reserva
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proyecto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Depto.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Broker
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comisión
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => {
                const paymentStatus = getPaymentStatus(payment);
                const showSecondPaymentButton = canCreateSecondPayment(payment);
                
                return (
                  <tr 
                    key={payment.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(payment)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.reservation_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.project.name} {payment.project.stage}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.apartment_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.broker.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {payment.broker_commission ? (
                        <>
                          {formatCurrency(payment.broker_commission.commission_amount)} UF
                          <br />
                          <span className="text-xs text-gray-500">
                            Neto: {formatCurrency(payment.broker_commission.net_commission)} UF
                          </span>
                          {payment.broker_commission.number_of_payments === 2 && (
                            <div className="text-xs text-gray-500">
                              ({payment.broker_commission.first_payment_percentage}% / {100 - payment.broker_commission.first_payment_percentage}%)
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400">Sin comisión</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center space-y-1">
                        {paymentStatus?.firstPaymentStatus && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            paymentStatus.firstPaymentStatus === 'completed' ? 'bg-green-100 text-green-800' :
                            paymentStatus.firstPaymentStatus === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            Pago 1: {
                              paymentStatus.firstPaymentStatus === 'completed' ? 'Completado' :
                              paymentStatus.firstPaymentStatus === 'in_progress' ? 'En Proceso' :
                              'Pendiente'
                            }
                          </span>
                        )}
                        {(paymentStatus?.secondPaymentStatus || payment.broker_commission?.payment_2_date) && (
                          <span className={`px-2 py-1 text-xs leading-5 font-semibold rounded-full ${
                            paymentStatus?.secondPaymentStatus === 'completed' || payment.broker_commission?.payment_2_date ? 'bg-green-100 text-green-800' :
                            paymentStatus?.secondPaymentStatus === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            Pago 2: {
                              paymentStatus?.secondPaymentStatus === 'completed' || payment.broker_commission?.payment_2_date ? 'Completado' :
                              paymentStatus?.secondPaymentStatus === 'in_progress' ? 'En Proceso' :
                              'Pendiente'
                            }
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => navigate(`/pagos/${payment.id}`)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Editar comisión"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        
                        {showSecondPaymentButton && (
                          <button
                            onClick={(e) => handleCreateSecondPaymentFlow(payment, e)}
                            className="text-green-600 hover:text-green-900"
                            title="Crear segundo pago"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
};

export default PaymentList;