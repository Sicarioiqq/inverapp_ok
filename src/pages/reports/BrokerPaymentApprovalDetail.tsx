import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import Layout from '../../components/Layout';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  DollarSign,
  Building2,
  User,
  Home,
  AlertTriangle,
  Clock,
  Wallet,
  TrendingDown,
  TrendingUp,
  Minus,
  Gift // Import Gift icon for promotions
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

// --- Definiciones de Tipos para Promociones (copiado de PaymentEdit.tsx) ---
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

interface BrokerPaymentApprovalDetail {
  // Información de la tarea
  taskId: string;
  taskName: string;
  taskStatus: string;
  startedAt: string | null;
  daysToComplete: number | null;
  daysPending: number;
  isOverdue: boolean;
  assignee: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  } | null;
  
  // Información del flujo
  commissionFlowId: string;
  flowStatus: string;
  
  // Información de la comisión
  brokerCommissionId: string;
  commissionAmount: number;
  commissionIncludesTax: boolean;
  netCommission: number;
  commissionForDiscount: boolean;
  paysSecondary: boolean;
  numberOfPayments: number;
  firstPaymentPercentage: number;
  
  // Información de la reserva
  reservationId: string;
  reservationNumber: string;
  reservationDate: string;
  promiseDate: string | null;
  deedDate: string | null;
  
  // Información del cliente
  clientId: string;
  clientName: string;
  clientRut: string;
  
  // Información del proyecto
  projectId: string;
  projectName: string;
  projectStage: string;
  
  // Información del departamento
  apartmentNumber: string;
  parkingNumber: string | null;
  storageNumber: string | null;
  
  // Información del broker
  brokerId: string;
  brokerName: string;
  brokerBusinessName: string;
  
  // Precios
  apartmentPrice: number;
  parkingPrice: number;
  storagePrice: number;
  totalPrice: number;
  
  // Descuentos
  columnDiscount: number;
  additionalDiscount: number;
  otherDiscount: number;
  minimumPrice: number;
  
  // Forma de pago
  reservationPayment: number;
  promisePayment: number;
  downPayment: number;
  creditPayment: number;
  subsidyPayment: number;
  totalPayment: number;
  recoveryPayment: number;
  
  // Diferencia calculada
  difference: number;
  totalPromotionsAgainstDiscount: number; // NUEVO: Total de promociones que son contra descuento
  appliedPromotions: AppliedPromotion[]; // NUEVO: Lista de promociones aplicadas
}

const BrokerPaymentApprovalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BrokerPaymentApprovalDetail | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    if (id && session?.user?.id) {
      fetchApprovalDetails();
    }
  }, [id, session?.user?.id]);

  const fetchApprovalDetails = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Get the commission flow task
      const { data: taskData, error: taskError } = await supabase
        .from('commission_flow_tasks')
        .select(`
          id,
          commission_flow_id,
          task_id,
          status,
          started_at,
          assignee:profiles(
            id,
            first_name,
            last_name,
            avatar_url
          ),
          task:payment_flow_tasks(
            name,
            days_to_complete
          )
        `)
        .eq('id', id)
        .single();

      if (taskError) throw taskError;
      
      // Get the commission flow
      const { data: flowData, error: flowError } = await supabase
        .from('commission_flows')
        .select(`
          id,
          status,
          broker_commission:broker_commissions(
            id,
            commission_amount,
            commission_includes_tax,
            net_commission,
            commission_for_discount,
            pays_secondary,
            number_of_payments,
            first_payment_percentage,
            reservation:reservations(
              id,
              reservation_number,
              reservation_date,
              promise_date,
              deed_date,
              apartment_number,
              parking_number,
              storage_number,
              apartment_price,
              parking_price,
              storage_price,
              total_price,
              column_discount,
              additional_discount,
              other_discount,
              minimum_price,
              reservation_payment,
              promise_payment,
              down_payment,
              credit_payment,
              subsidy_payment,
              total_payment,
              recovery_payment,
              client:clients(
                id,
                first_name,
                last_name,
                rut
              ),
              project:projects(
                id,
                name,
                stage
              ),
              broker:brokers(
                id,
                name,
                business_name
              ),
              promotions:promotions(*)
            )
          )
        `)
        .eq('id', taskData.commission_flow_id)
        .single();

      if (flowError) throw flowError;
      
      // Calculate days pending
      const startedAt = taskData.started_at ? new Date(taskData.started_at) : null;
      const daysPending = startedAt ? differenceInDays(new Date(), startedAt) : 0;
      const daysToComplete = taskData.task?.days_to_complete || null;
      const isOverdue = daysToComplete !== null && daysPending > daysToComplete;
      
      // Calculate total promotions that are "against discount"
      const promotions = flowData.broker_commission.reservation.promotions || [];
      const totalPromotionsAgainstDiscount = promotions.reduce((sum: number, promo: any) => {
        if (promo.is_against_discount) {
          return sum + (promo.amount || 0);
        }
        return sum;
      }, 0);

      // Calculate difference (Recuperación - Mínimo - Comisión - Promociones Contra Descuento)
      const totalPayment = flowData.broker_commission.reservation.total_payment;
      const subsidyPayment = flowData.broker_commission.reservation.subsidy_payment;
      const recoveryPayment = totalPayment - subsidyPayment;
      
      const minimumPrice = flowData.broker_commission.reservation.minimum_price;
      const commissionAmount = flowData.broker_commission.commission_amount;
      
      const difference = recoveryPayment - minimumPrice - commissionAmount - totalPromotionsAgainstDiscount; // MODIFICADO

      // Save the difference to the broker_commission record (if the column exists)
      // NOTE: This assumes 'difference' column exists in 'broker_commissions' table.
      // If not, this line might cause an error or simply not save the value.
      await supabase
        .from('broker_commissions')
        .update({ difference: difference })
        .eq('id', flowData.broker_commission.id);
      
      // Format the data
      const formattedData: BrokerPaymentApprovalDetail = {
        // Información de la tarea
        taskId: taskData.id,
        taskName: taskData.task?.name || 'Unknown Task',
        taskStatus: taskData.status,
        startedAt: taskData.started_at,
        daysToComplete: daysToComplete,
        daysPending: daysPending,
        isOverdue: isOverdue,
        assignee: taskData.assignee,
        
        // Información del flujo
        commissionFlowId: flowData.id,
        flowStatus: flowData.status,
        
        // Información de la comisión
        brokerCommissionId: flowData.broker_commission.id,
        commissionAmount: flowData.broker_commission.commission_amount,
        commissionIncludesTax: flowData.broker_commission.commission_includes_tax,
        netCommission: flowData.broker_commission.net_commission,
        commissionForDiscount: flowData.broker_commission.commission_for_discount,
        paysSecondary: flowData.broker_commission.pays_secondary,
        numberOfPayments: flowData.broker_commission.number_of_payments,
        firstPaymentPercentage: flowData.broker_commission.first_payment_percentage,
        
        // Información de la reserva
        reservationId: flowData.broker_commission.reservation.id,
        reservationNumber: flowData.broker_commission.reservation.reservation_number,
        reservationDate: flowData.broker_commission.reservation.reservation_date,
        promiseDate: flowData.broker_commission.reservation.promise_date,
        deedDate: flowData.broker_commission.reservation.deed_date,
        
        // Información del cliente
        clientId: flowData.broker_commission.reservation.client.id,
        clientName: `${flowData.broker_commission.reservation.client.first_name} ${flowData.broker_commission.reservation.client.last_name}`,
        clientRut: flowData.broker_commission.reservation.client.rut,
        
        // Información del proyecto
        projectId: flowData.broker_commission.reservation.project.id,
        projectName: flowData.broker_commission.reservation.project.name,
        projectStage: flowData.broker_commission.reservation.project.stage,
        
        // Información del departamento
        apartmentNumber: flowData.broker_commission.reservation.apartment_number,
        parkingNumber: flowData.broker_commission.reservation.parking_number,
        storageNumber: flowData.broker_commission.reservation.storage_number,
        
        // Información del broker
        brokerId: flowData.broker_commission.reservation.broker.id,
        brokerName: flowData.broker_commission.reservation.broker.name,
        brokerBusinessName: flowData.broker_commission.reservation.broker.business_name,
        
        // Precios
        apartmentPrice: flowData.broker_commission.reservation.apartment_price,
        parkingPrice: flowData.broker_commission.reservation.parking_price,
        storagePrice: flowData.broker_commission.reservation.storage_price,
        totalPrice: flowData.broker_commission.reservation.total_price,
        
        // Descuentos
        columnDiscount: flowData.broker_commission.reservation.column_discount * 100, // Convert to percentage
        additionalDiscount: flowData.broker_commission.reservation.additional_discount * 100, // Convert to percentage
        otherDiscount: flowData.broker_commission.reservation.other_discount * 100, // Convert to percentage
        minimumPrice: flowData.broker_commission.reservation.minimum_price,
        
        // Forma de pago
        reservationPayment: flowData.broker_commission.reservation.reservation_payment,
        promisePayment: flowData.broker_commission.reservation.promise_payment,
        downPayment: flowData.broker_commission.reservation.down_payment,
        creditPayment: flowData.broker_commission.reservation.credit_payment,
        subsidyPayment: flowData.broker_commission.reservation.subsidy_payment,
        totalPayment: flowData.broker_commission.reservation.total_payment,
        recoveryPayment: recoveryPayment, // Calculado como total_payment - subsidy_payment
        
        // Diferencia calculada
        difference: difference,
        totalPromotionsAgainstDiscount: totalPromotionsAgainstDiscount, // NUEVO: Incluir en los datos formateados
        appliedPromotions: promotions, // NUEVO: Incluir la lista de promociones en los datos formateados
      };
      
      setData(formattedData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!data) return;
    
    try {
      setIsApproving(true);
      
      // Update the task to completed
      const { error: updateError } = await supabase
        .from('commission_flow_tasks')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', data.taskId);
        
      if (updateError) throw updateError;
      
      // Navigate back to the approval list
      navigate('/informes/aprobacion-liquidaciones');
    } catch (err: any) {
      setError(err.message);
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!data || !rejectReason.trim()) return;
    
    try {
      setIsRejecting(true);
      
      // Update the task to blocked
      const { error: updateError } = await supabase
        .from('commission_flow_tasks')
        .update({ 
          status: 'blocked'
        })
        .eq('id', data.taskId);
        
      if (updateError) throw updateError;
      
      // Add a comment with the rejection reason
      const { error: commentError } = await supabase
        .from('commission_task_comments')
        .insert({
          commission_flow_task_id: data.taskId,
          user_id: session?.user.id,
          content: `RECHAZO: ${rejectReason}`
        });
        
      if (commentError) throw commentError;
      
      // Navigate back to the approval list
      navigate('/informes/aprobacion-liquidaciones');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRejecting(false);
      setShowRejectModal(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No especificada';
    
    try {
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy', { locale: es });
    } catch (error) {
      return dateString;
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
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

  if (error || !data) {
    return (
      <Layout>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error || 'No se encontró la información de aprobación'}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/informes/aprobacion-liquidaciones')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Volver
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Aprobación de Liquidación - Reserva {data.reservationNumber}
          </h1>
        </div>

        {/* Información de la tarea */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Información de la Tarea
            </h2>
            <div className="flex items-center">
              <span className={`px-3 py-1 inline-flex items-center rounded-full text-sm font-medium ${
                data.isOverdue ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {data.isOverdue ? (
                  <AlertTriangle className="h-4 w-4 mr-1" />
                ) : (
                  <Clock className="h-4 w-4 mr-1" />
                )}
                <span>
                  {data.daysPending} días pendiente
                  {data.daysToComplete && ` (Plazo: ${data.daysToComplete} días)`}
                </span>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Tarea
              </label>
              <div className="mt-1 text-gray-900">
                {data.taskName}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fecha de Inicio
              </label>
              <div className="mt-1 text-gray-900">
                {data.startedAt ? formatDate(data.startedAt) : 'No iniciada'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Responsable
              </label>
              <div className="mt-1 text-gray-900">
                {data.assignee ? `${data.assignee.first_name} ${data.assignee.last_name}` : 'Sin asignar'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Información del Cliente */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <User className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Información del Cliente
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre
                </label>
                <div className="mt-1 text-gray-900">
                  {data.clientName}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  RUT
                </label>
                <div className="mt-1 text-gray-900">
                  {data.clientRut}
                </div>
              </div>
            </div>
          </div>

          {/* Información del Broker */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <Building2 className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Información del Broker
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre
                </label>
                <div className="mt-1 text-gray-900">
                  {data.brokerName}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Razón Social
                </label>
                <div className="mt-1 text-gray-900">
                  {data.brokerBusinessName}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Información de la Reserva */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <Home className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Información de la Reserva
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  N° Reserva
                </label>
                <div className="mt-1 text-gray-900">
                  {data.reservationNumber}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fecha Reserva
                </label>
                <div className="mt-1 text-gray-900">
                  {formatDate(data.reservationDate)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Proyecto
                </label>
                <div className="mt-1 text-gray-900">
                  {data.projectName} {data.projectStage}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Unidad
                </label>
                <div className="mt-1 text-gray-900">
                  Depto. {data.apartmentNumber}
                  {data.parkingNumber && ` | Est. ${data.parkingNumber}`}
                  {data.storageNumber && ` | Bod. ${data.storageNumber}`}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fecha Promesa
                </label>
                <div className="mt-1 text-gray-900">
                  {formatDate(data.promiseDate)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fecha Escritura
                </label>
                <div className="mt-1 text-gray-900">
                  {formatDate(data.deedDate)}
                </div>
              </div>
            </div>
          </div>

          {/* Información de la Comisión */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <Wallet className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Información de la Comisión
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Monto Comisión
                </label>
                <div className="mt-1 text-gray-900 font-semibold">
                  {formatCurrency(data.commissionAmount)} UF
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Comisión Neta (sin IVA)
                </label>
                <div className="mt-1 text-gray-900">
                  {formatCurrency(data.netCommission)} UF
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Incluye IVA
                </label>
                <div className="mt-1 text-gray-900">
                  {data.commissionIncludesTax ? 'Sí' : 'No'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Sobre Precio con Descuento
                </label>
                <div className="mt-1 text-gray-900">
                  {data.commissionForDiscount ? 'Sí' : 'No'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Paga Secundarios
                </label>
                <div className="mt-1 text-gray-900">
                  {data.paysSecondary ? 'Sí' : 'No'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Número de Pagos
                </label>
                <div className="mt-1 text-gray-900">
                  {data.numberOfPayments}
                </div>
              </div>
              {data.numberOfPayments > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Porcentaje Primer Pago
                  </label>
                  <div className="mt-1 text-gray-900">
                    {data.firstPaymentPercentage}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Precios y Descuentos */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <DollarSign className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Precios y Descuentos
              </h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Precio Departamento
                  </label>
                  <div className="mt-1 text-gray-900">
                    {formatCurrency(data.apartmentPrice)} UF
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Precio Estacionamiento
                  </label>
                  <div className="mt-1 text-gray-900">
                    {formatCurrency(data.parkingPrice)} UF
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Precio Bodega
                  </label>
                  <div className="mt-1 text-gray-900">
                    {formatCurrency(data.storagePrice)} UF
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Total Lista
                  </label>
                  <div className="mt-1 text-gray-900 font-semibold">
                    {formatCurrency(data.totalPrice)} UF
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Descuentos</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Descuento Columna
                    </label>
                    <div className="mt-1 text-gray-900">
                      {formatPercentage(data.columnDiscount)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Descuento Adicional
                    </label>
                    <div className="mt-1 text-gray-900">
                      {formatPercentage(data.additionalDiscount)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Otros Descuentos
                    </label>
                    <div className="mt-1 text-gray-900">
                      {formatPercentage(data.otherDiscount)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Precio Mínimo
                    </label>
                    <div className="mt-1 text-gray-900 font-semibold">
                      {formatCurrency(data.minimumPrice)} UF
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Forma de Pago */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <Calendar className="h-5 w-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Forma de Pago
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Reserva
                </label>
                <div className="mt-1 text-gray-900">
                  {formatCurrency(data.reservationPayment)} UF
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Promesa
                </label>
                <div className="mt-1 text-gray-900">
                  {formatCurrency(data.promisePayment)} UF
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Pie
                </label>
                <div className="mt-1 text-gray-900">
                  {formatCurrency(data.downPayment)} UF
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Crédito
                </label>
                <div className="mt-1 text-gray-900">
                  {formatCurrency(data.creditPayment)} UF
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Bono Pie
                </label>
                <div className="mt-1 text-gray-900">
                  {formatCurrency(data.subsidyPayment)} UF
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Total Escrituración
                </label>
                <div className="mt-1 text-gray-900 font-semibold">
                  {formatCurrency(data.totalPayment)} UF
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- NUEVO: Sección de Promociones Aplicadas (copiada de PaymentEdit.tsx para visualización) --- */}
        {data.appliedPromotions.length > 0 && ( // Use data.appliedPromotions
          <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <Gift className="h-6 w-6 mr-2 text-purple-600" />
                Promociones Aplicadas (Solo para visualización en esta pantalla)
              </h2>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {data.appliedPromotions.map((promo) => ( // Use data.appliedPromotions
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
                      {promo.document_number && (<p><strong>Doc. Pago N°:</strong> {promo.document_number} {promo.document_date ? `(Fecha Emisión: ${formatDate(promo.document_date)})` : ''}</p>)}
                      {promo.payment_date && (<p><strong>Fecha Pago Promoción:</strong> {formatDate(promo.payment_date)}</p>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* --- FIN SECCIÓN: Promociones Aplicadas --- */}

        {/* Resumen Financiero */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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
                {formatCurrency(data.totalPayment)} UF
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <Wallet className="h-5 w-5 text-gray-500 mr-2" />
                <h3 className="text-sm font-medium text-gray-700">Total Recuperación</h3>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(data.recoveryPayment)} UF
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <DollarSign className="h-5 w-5 text-gray-500 mr-2" />
                <h3 className="text-sm font-medium text-gray-700">Precio Mínimo</h3>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(data.minimumPrice)} UF
              </div>
            </div>
            
            <div className={`p-4 rounded-lg ${data.difference >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center mb-2">
                {data.difference >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
                ) : data.difference < 0 ? (
                  <TrendingDown className="h-5 w-5 text-red-500 mr-2" />
                ) : (
                  <Minus className="h-5 w-5 text-gray-500 mr-2" />
                )}
                <h3 className="text-sm font-medium text-gray-700">Diferencia</h3>
              </div>
              <div className={`text-xl font-bold ${
                data.difference > 0 
                  ? 'text-green-600' 
                  : data.difference < 0 
                    ? 'text-red-600' 
                    : 'text-gray-900'
              }`}>
                {formatCurrency(data.difference)} UF
              </div>
              <div className="text-xs text-gray-500 mt-1">
                (Recuperación - Mínimo - Comisión - Promociones Contra Descuento)
              </div>
            </div>
            {/* NUEVO: Mostrar el total de promociones descontadas para transparencia */}
            {data.totalPromotionsAgainstDiscount > 0 && (
                <div className="mt-4 pt-3 border-t col-span-full">
                    <p className="text-sm text-gray-600">
                        Total Promociones (Contra Descuento) aplicadas en Diferencia: 
                        <span className="font-semibold text-orange-600"> {formatCurrency(data.totalPromotionsAgainstDiscount)} UF</span>
                    </p>
                </div>
            )}
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex justify-end space-x-4 mb-6">
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={isApproving || isRejecting}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {isRejecting ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Rechazando...
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 mr-2" />
                Rechazar
              </>
            )}
          </button>
          <button
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isApproving ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Aprobando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Aprobar
              </>
            )}
          </button>
        </div>

        {/* Modal de Rechazo */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                      <XCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Rechazar Aprobación
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Por favor, indique el motivo del rechazo:
                        </p>
                        <textarea
                          className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                          rows={4}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Motivo del rechazo..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={!rejectReason.trim() || isRejecting}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isRejecting ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Rechazando...
                      </>
                    ) : (
                      'Confirmar Rechazo'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    disabled={isRejecting}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BrokerPaymentApprovalDetail;