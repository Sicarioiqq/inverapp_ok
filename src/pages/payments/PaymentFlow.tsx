import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile, formatDateTimeChile, formatCurrency } from '../../lib/supabase';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import { PDFDownloadLink } from '@react-pdf/renderer';
import LiquidacionPagoBrokerPDF from '../../components/pdf/LiquidacionPagoBrokerPDF'; // Correcta ruta
import {
  ArrowLeft, Clock, CheckCircle2, AlertCircle, UserCircle, UserPlus,
  MessageSquare, Play, Loader2, Calendar, AlertTriangle, Timer, Edit,
  ChevronDown, ChevronRight, Edit2, Users, ListChecks, FileText,
  ClipboardList, DollarSign, Plus, Info, TrendingUp, Wallet, TrendingDown, Minus, Gift
} from 'lucide-react';
import { differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import CommissionTaskCommentPopup from '../../components/CommissionTaskCommentPopup';
import CommissionTaskCommentList from '../../components/CommissionTaskCommentList';

// --- Definiciones de Tipos (como las tenías) ---
export const PROMOTION_TYPES_ARRAY = [
  'Arriendo garantizado', 'Cashback', 'Giftcard', 'Bono Ejecutivo', 'Crédito al Pie', 'Dividendo Garantizado'
] as const;
export type PromotionType = typeof PROMOTION_TYPES_ARRAY[number];
export interface AppliedPromotion {
  id: string; reservation_id: string; promotion_type: PromotionType;
  is_against_discount: boolean; observations?: string | null; amount: number; 
  beneficiary: string; rut: string; bank: string; account_type: string;
  account_number: string; email: string; purchase_order?: string | null;
  document_number?: string | null; document_date?: string | null; 
  payment_date?: string | null;  created_at?: string;
}
interface Task {
  id: string; commission_flow_task_id?: string; name: string; status: string;
  started_at?: string; completed_at?: string; assigned_at?: string;
  expected_date?: string; days_to_complete?: number;
  assignee?: { id: string; first_name: string; last_name: string; avatar_url?: string; };
  default_assignee?: { id: string; first_name: string; last_name: string; avatar_url?: string; };
  comments_count: number; isCollapsed?: boolean;
}
interface Stage {
  id: string; name: string; tasks: Task[]; isCompleted: boolean; isExpanded: boolean;
}
interface PaymentFlow {
  id: string; status: string; started_at: string | null; completed_at: string | null;
  is_second_payment: boolean; flow: { id: string; };
  broker_commission: {
    id: string; commission_amount: number; number_of_payments: number;
    first_payment_percentage: number; at_risk: boolean; at_risk_reason: string | null;
    reservation: {
      id: string; reservation_number: string; 
      // --- MODIFICACIÓN: Asegurar que estos campos estén en la interfaz si se seleccionan ---
      total_payment?: number; 
      subsidy_payment?: number; 
      minimum_price?: number; 
      client: { id: string; first_name: string; last_name: string; rut: string;};
      project: { name: string; stage: string; };
      apartment_number: string;
      broker: { id: string; name: string; business_name: string; };
    };
  };
  current_stage: { id: string; name: string; } | null;
  stages: Stage[];
}
interface User { /* ... (sin cambios) ... */ }
interface FinancialSummaryForPDF {
    totalPayment: number; recoveryPayment: number; minimumPrice: number;
    difference: number; totalCommissionUF: number; firstPaymentUF: number;
    secondPaymentUF?: number; totalPromotionsAgainstDiscount: number;
}
// --- Fin Tipos ---

const retryOperation = async ( /* ... (código sin cambios) ... */ ): Promise<any> => { /* ... */ };

const PaymentFlowPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Este 'id' es el commission_flow_id
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const [flow, setFlow] = useState<PaymentFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPdfData, setLoadingPdfData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [startingFlow, setStartingFlow] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [editingTaskDate, setEditingTaskDate] = useState<{ taskId: string; type: 'start' | 'complete';} | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [commentRefreshTrigger, setCommentRefreshTrigger] = useState(0);
  const [creatingSecondFlow, setCreatingSecondFlow] = useState(false);
  const [tempDateValue, setTempDateValue] = useState('');
  const [markingAtRisk, setMarkingAtRisk] = useState(false);
  
  const [appliedPromotions, setAppliedPromotions] = useState<AppliedPromotion[]>([]);
  const [financialSummaryForPDF, setFinancialSummaryForPDF] = useState<FinancialSummaryForPDF | null>(null);

  useEffect(() => {
    if (id) {
      setLoading(true);
      setError(null); // Limpiar errores previos al recargar
      Promise.all([
        fetchFlow(),
        fetchUsers(),
        checkAdminStatus()
      ]).catch((err) => {
        console.error("Error en la carga inicial:", err);
        setError(err.message || "Error al cargar datos del flujo.");
      }).finally(() => {
        setLoading(false);
      });
    } else {
      navigate('/pagos');
    }
  }, [id, commentRefreshTrigger]);

  useEffect(() => {
    const loadDependentData = async () => {
      if (flow && flow.broker_commission?.reservation?.id) {
        const reservationId = flow.broker_commission.reservation.id;
        setLoadingPdfData(true);
        setError(null); // Limpiar errores de datos dependientes previos
        try {
          const { data: promos, error: promoError } = await supabase
            .from('promotions')
            .select('*')
            .eq('reservation_id', reservationId)
            .order('created_at', { ascending: true });
          if (promoError) throw promoError;
          const currentPromotions = (promos as AppliedPromotion[]) || [];
          setAppliedPromotions(currentPromotions);

          const commissionData = flow.broker_commission;
          const reservationData = flow.broker_commission.reservation;

          if (commissionData && reservationData) {
            const totalPaymentVal = reservationData.total_payment || 0;
            const subsidyPaymentVal = reservationData.subsidy_payment || 0;
            const recoveryPaymentVal = totalPaymentVal - subsidyPaymentVal;
            const minimumPriceVal = reservationData.minimum_price || 0;
            const commissionAmountForCalc = commissionData.commission_amount || 0;

            const totalPromosAgainstDiscount = currentPromotions.reduce((sum, promo) => {
              if (promo.is_against_discount) {
                return sum + (promo.amount || 0);
              }
              return sum;
            }, 0);
            
            const differenceVal = recoveryPaymentVal - minimumPriceVal - commissionAmountForCalc - totalPromosAgainstDiscount;
            const firstPaymentUFCalc = commissionAmountForCalc * (commissionData.first_payment_percentage / 100);
            const secondPaymentUFCalc = commissionData.number_of_payments === 2 ? commissionAmountForCalc - firstPaymentUFCalc : 0;

            setFinancialSummaryForPDF({
              totalPayment: totalPaymentVal,
              recoveryPayment: recoveryPaymentVal,
              minimumPrice: minimumPriceVal,
              difference: differenceVal,
              totalCommissionUF: commissionAmountForCalc,
              firstPaymentUF: firstPaymentUFCalc,
              secondPaymentUF: secondPaymentUFCalc,
              totalPromotionsAgainstDiscount: totalPromosAgainstDiscount,
            });
          } else {
            setFinancialSummaryForPDF(null); // Asegurar que es null si no hay datos
          }
        } catch (err: any) {
          console.error("Error cargando datos dependientes para PDF:", err);
          setError(prev => prev ? `${prev}\nError al cargar datos para PDF: ${err.message}` : `Error al cargar datos para PDF: ${err.message}`);
          setAppliedPromotions([]); // Limpiar en caso de error
          setFinancialSummaryForPDF(null); // Limpiar en caso de error
        } finally {
          setLoadingPdfData(false);
        }
      } else if (flow) { // Si hay flow pero no datos de comisión/reserva para el PDF
          setLoadingPdfData(false); // Asegurarse que no se quede cargando PDF data indefinidamente
          setAppliedPromotions([]);
          setFinancialSummaryForPDF(null);
      }
    };

    if (flow) {
        loadDependentData();
    }
  }, [flow]); 

  const checkAdminStatus = async () => { /* ... (código sin cambios) ... */ };
  const fetchUsers = async () => { /* ... (código sin cambios) ... */ };
  
  const fetchFlow = async () => {
    // setLoading y setError se manejan en el useEffect que llama a esta función
    try {
      const { data: flowData, error: flowError } = await supabase
        .from('commission_flows')
        .select(`
          id, status, started_at, completed_at, is_second_payment,
          flow:payment_flows(id),
          current_stage:payment_flow_stages(id, name),
          broker_commission:broker_commissions(
            id, commission_amount, number_of_payments, first_payment_percentage, at_risk, at_risk_reason,
            reservation:reservations(
              id, reservation_number, apartment_number, 
              total_payment, subsidy_payment, minimum_price, /* <-- CAMPOS NECESARIOS PARA RESUMEN */
              client:clients(id, first_name, last_name, rut),
              project:projects(name, stage),
              broker:brokers(id, name, business_name)
            )
          )
        `)
        .eq('id', id) // 'id' aquí es el commission_flow_id
        .single();
      
      // --- MODIFICACIÓN: Manejo explícito si flowData no se encuentra ---
      if (flowError) throw flowError; // Errores de DB
      if (!flowData) {
        setFlow(null); // Asegurar que flow sea null
        throw new Error("Flujo de comisión no encontrado o datos incompletos.");
      }

      // --- MODIFICACIÓN: Verificar que los datos anidados cruciales existan ---
      if (!flowData.broker_commission || !flowData.broker_commission.reservation) {
        setFlow(null);
        throw new Error("Datos de comisión o reserva asociados al flujo son incompletos.");
      }

      const { data: stagesData, error: stagesError } = await supabase
        .from('payment_flow_stages')
        .select(`id, name, order, tasks:payment_flow_tasks(id, name, days_to_complete, default_assignee:profiles(id, first_name, last_name, avatar_url))`)
        .eq('flow_id', flowData.flow.id)
        .order('order', { ascending: true });
      if (stagesError) throw stagesError;

      const { data: flowTasks, error: tasksError } = await supabase
        .from('commission_flow_tasks')
        .select(`id, task_id, status, started_at, completed_at, assigned_at, assignee:profiles(id, first_name, last_name, avatar_url)`)
        .eq('commission_flow_id', id);
      if (tasksError) throw tasksError;
      
      const commissionFlowTaskIds = flowTasks?.map(ft => ft.id) || [];
      let commentsData: { commission_flow_task_id: string }[] = [];
      if (commissionFlowTaskIds.length > 0) {
        const { data: fetchedCommentsData, error: commentsFetchError } = await supabase
          .from('commission_task_comments').select('commission_flow_task_id').in('commission_flow_task_id', commissionFlowTaskIds);
        if (commentsFetchError) throw commentsFetchError;
        commentsData = fetchedCommentsData || [];
      }
      
      const commentCounts: Record<string, number> = {};
      commentsData.forEach(comment => {
        if (comment.commission_flow_task_id) {
          commentCounts[comment.commission_flow_task_id] = (commentCounts[comment.commission_flow_task_id] || 0) + 1;
        }
      });

      const stages = stagesData?.map(stage => {
        const stageTasks = stage.tasks.map(taskTemplate => {
          const flowTaskInstance = flowTasks?.find(ft => ft.task_id === taskTemplate.id);
          const isCompleted = flowTaskInstance?.status === 'completed';
          const taskCommentCount = flowTaskInstance ? (commentCounts[flowTaskInstance.id] || 0) : 0;
          return {
            id: taskTemplate.id, commission_flow_task_id: flowTaskInstance?.id, name: taskTemplate.name,
            status: flowTaskInstance?.status || 'blocked', started_at: flowTaskInstance?.started_at,
            completed_at: flowTaskInstance?.completed_at, assigned_at: flowTaskInstance?.assigned_at,
            days_to_complete: taskTemplate.days_to_complete, assignee: flowTaskInstance?.assignee,
            default_assignee: taskTemplate.default_assignee, comments_count: taskCommentCount,
            isCollapsed: isCompleted, 
          };
        });
        return {
          id: stage.id, name: stage.name, tasks: stageTasks,
          isCompleted: stageTasks.every(task => task.status === 'completed'),
          isExpanded: true,
        };
      }) || [];
      setFlow({ ...flowData, stages } as PaymentFlow); // Asegurar el tipo aquí
    } catch (err) {
      setFlow(null); // En caso de cualquier error, setear flow a null
      throw err; // Propagar para que el useEffect principal lo capture en setError
    }
  };
  const handleStartFlow = async () => { /* ... (sin cambios) ... */ };
  const handleStartDateChange = async (date: string) => { /* ... (sin cambios) ... */ };
  const handleTaskDateChange = async (templateTaskId: string, date: string, type: 'start' | 'complete') => { /* ... (sin cambios) ... */ };
  const handleAssign = async (templateTaskId: string, currentAssignee: User | null, defaultAssignee: User | null) => { /* ... (sin cambios) ... */ };
  const assignUser = async (templateTaskId: string, user: User) => { /* ... (sin cambios) ... */ };
  // useEffect para auto-asignar (sin cambios)
  // useEffect para scroll (sin cambios)
  const handleStatusChange = async (templateTaskId: string, newStatus: string) => { /* ... (sin cambios) ... */ };
  const handleAddComment = async (taskInstanceId: string | undefined) => { /* ... (sin cambios) ... */ };
  const toggleTaskComments = (taskInstanceId: string | undefined) => { /* ... (sin cambios) ... */ };
  const toggleTaskCollapse = (stageIndex: number, taskIndex: number) => { /* ... (sin cambios) ... */ };
  const toggleStage = (stageIndex: number) => { /* ... (sin cambios) ... */ };
  const getStatusIcon = (status: string) => { /* ... (sin cambios) ... */ };
  const getStatusText = (status: string) => { /* ... (sin cambios) ... */ };
  const getStatusColor = (status: string) => { /* ... (sin cambios) ... */ };
  const calculateProgress = () => { /* ... (sin cambios) ... */ };
  const getDaysElapsed = (startDate?: string, endDate?: string) => { /* ... (sin cambios) ... */ };
  const getExpectedDate = (task: Task) => { /* ... (sin cambios) ... */ };
  const getDaysOverdue = (task: Task) => { /* ... (sin cambios) ... */ };
  // formatDate, formatDateTime, formatCurrency ya están importados
  const navigateToEditClient = () => { /* ... (sin cambios) ... */ };
  const navigateToEditReservation = () => { /* ... (sin cambios) ... */ };
  const navigateToEditCommission = () => { /* ... (sin cambios) ... */ };
  const navigateToReservationFlow = async () => { /* ... (sin cambios) ... */ };
  const navigateToDocuments = () => { /* ... (sin cambios) ... */ };
  const navigateToTaskTracking = () => { /* ... (sin cambios) ... */ };
  const handleCreateSecondPaymentFlow = async () => { /* ... (sin cambios) ... */ };
  const handleDateInputChange = async (e: React.ChangeEvent<HTMLInputElement>, templateTaskId: string, type: 'start' | 'complete') => { /* ... (sin cambios) ... */ };
  const handleToggleAtRisk = () => { /* ... (sin cambios, asegúrate que AtRiskPopup se importe si es necesario) ... */ };


  if (loading) { return <Layout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div></Layout>; }
  
  // --- MODIFICACIÓN: Manejo de error y estado !flow más robusto ---
  if (error) { 
    return <Layout><div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">Error: {error} <button onClick={() => navigate('/pagos')} className="ml-4 text-blue-600 hover:underline">Volver a Pagos</button></div></Layout>; 
  }
  if (!flow) { 
    return <Layout><div className="p-4 text-center text-gray-500">No se encontró información para este flujo de pago o los datos son incompletos. <button onClick={() => navigate('/pagos')} className="text-blue-600 hover:underline">Volver a Pagos</button></div></Layout>; 
  }
  // A partir de aquí, 'flow' no es null y tiene la estructura esperada (o se lanzó un error antes)
  // Y también flow.broker_commission y flow.broker_commission.reservation no deberían ser null.

  const canCreateSecondPaymentFlow = flow.status === 'completed' && flow.broker_commission?.number_of_payments === 2 && !flow.is_second_payment;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/pagos')} className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-5 w-5 mr-2" /> Volver
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">
                {/* --- MODIFICACIÓN: Añadido optional chaining --- */}
                {flow.is_second_payment ? 'Segundo Pago' : 'Flujo de Pago'} - Reserva {flow.broker_commission?.reservation?.reservation_number || 'N/A'}
            </h1>
            <div className="flex space-x-1 md:space-x-2">
                <button onClick={navigateToEditClient} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Cliente"><Users className="h-5 w-5" /></button>
                <button onClick={navigateToEditReservation} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Reserva"><Edit2 className="h-5 w-5" /></button>
                <button onClick={navigateToEditCommission} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Comisión"><DollarSign className="h-5 w-5" /></button>
                <button onClick={navigateToReservationFlow} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Flujo de Reserva"><ListChecks className="h-5 w-5" /></button>
            </div>
        </div>
        
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div> 
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>
                        <dl className="space-y-2 text-sm">
                            {/* --- MODIFICACIÓN: Añadido optional chaining --- */}
                            <div><dt className="font-medium text-gray-500">Cliente</dt><dd className="text-gray-900">{flow.broker_commission?.reservation?.client?.first_name} {flow.broker_commission?.reservation?.client?.last_name}</dd></div>
                            <div><dt className="font-medium text-gray-500">Proyecto</dt><dd className="text-gray-900">{flow.broker_commission?.reservation?.project?.name} {flow.broker_commission?.reservation?.project?.stage} - {flow.broker_commission?.reservation?.apartment_number}</dd></div>
                            <div><dt className="font-medium text-gray-500">Broker</dt><dd className="text-gray-900">{flow.broker_commission?.reservation?.broker?.name}</dd></div>
                            <div><dt className="font-medium text-gray-500">Monto Comisión</dt><dd className="text-gray-900">{flow.is_second_payment ? `${formatCurrency(((100 - (flow.broker_commission?.first_payment_percentage || 0)) / 100 * (flow.broker_commission?.commission_amount || 0)))} UF (${100 - (flow.broker_commission?.first_payment_percentage || 0)}%)` : `${formatCurrency((((flow.broker_commission?.first_payment_percentage || 0) / 100) * (flow.broker_commission?.commission_amount || 0)))} UF (${flow.broker_commission?.first_payment_percentage || 0}%)`}</dd></div>
                            {flow.broker_commission?.number_of_payments === 2 && (<div><dt className="font-medium text-gray-500">Tipo de Pago</dt><dd className="text-gray-900">{flow.is_second_payment ? 'Segundo Pago' : 'Primer Pago'}</dd></div>)}
                            {flow.broker_commission?.at_risk && (<div><dt className="font-medium text-gray-500">Estado Riesgo</dt><dd className="text-sm flex items-center"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><AlertCircle className="h-4 w-4 mr-1" />En Riesgo</span>{flow.broker_commission.at_risk_reason && (<span className="ml-2 text-gray-500 italic">{flow.broker_commission.at_risk_reason}</span>)}</dd></div>)}
                        </dl>
                    </div>
                    <div> 
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Estado del Proceso</h2>
                             <div className="flex space-x-2">
                                {isAdmin && flow.status === 'pending' && (<button onClick={handleStartFlow} disabled={startingFlow} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">{startingFlow ? (<><Loader2 className="animate-spin h-4 w-4 mr-2" />Iniciando...</>) : (<><Play className="h-4 w-4 mr-2" />Proceder</>)}</button>)}
                                {canCreateSecondPaymentFlow && (<button onClick={handleCreateSecondPaymentFlow} disabled={creatingSecondFlow} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50">{creatingSecondFlow ? (<><Loader2 className="animate-spin h-4 w-4 mr-2" />Creando...</>) : (<><Plus className="h-4 w-4 mr-2" />2do Pago</>)}</button>)}
                                {flow.status === 'in_progress' && !flow.broker_commission?.at_risk && (<button onClick={handleToggleAtRisk} disabled={markingAtRisk} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50">{markingAtRisk ? (<><Loader2 className="animate-spin h-4 w-4 mr-2" />Procesando...</>) : (<><AlertCircle className="h-4 w-4 mr-2" />En Riesgo</>)}</button>)}
                                {flow.status === 'in_progress' && flow.broker_commission?.at_risk && (<button onClick={handleToggleAtRisk} disabled={markingAtRisk} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">{markingAtRisk ? (<><Loader2 className="animate-spin h-4 w-4 mr-2" />Procesando...</>) : (<><Edit className="h-4 w-4 mr-2" />Editar Riesgo</>)}</button>)}
                            </div>
                        </div>
                        <div className="space-y-4 text-sm">
                            <div><div className="flex justify-between font-medium text-gray-500 mb-1"><span>Progreso</span><span>{Math.round(calculateProgress())}%</span></div><div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${calculateProgress()}%` }}></div></div></div>
                            <div><dt className="font-medium text-gray-500">Iniciado</dt><dd className="text-gray-900">{flow.started_at ? (<div className="flex items-center">{editingStartDate ? (<input type="datetime-local" defaultValue={flow.started_at.split('.')[0]} onChange={(e) => handleStartDateChange(e.target.value)} className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />) : (<><span>{formatDateTime(flow.started_at)}</span>{isAdmin && (<button onClick={() => setEditingStartDate(true)} className="ml-2 text-blue-600 hover:text-blue-800" title="Editar fecha"><Edit className="h-4 w-4" /></button>)}</>)}</div>) : (<span className="text-gray-500">No iniciado</span>)}</dd></div>
                            {flow.completed_at && (<div><dt className="font-medium text-gray-500">Completado</dt><dd className="text-gray-900">{formatDateTime(flow.completed_at)}</dd></div>)}
                            <div><dt className="font-medium text-gray-500">Días Transcurridos</dt><dd className="text-gray-900">{getDaysElapsed(flow.started_at || undefined, flow.completed_at)} días</dd></div>
                            <div><dt className="font-medium text-gray-500">Etapa Actual</dt><dd className="text-gray-900">{flow.current_stage?.name || 'No iniciado'}</dd></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- NUEVA TARJETA: Informes y Documentos --- */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3 flex items-center">
                    <FileText className="h-6 w-6 mr-2 text-gray-700" />
                    Informes y Documentos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Botón para PDF de Liquidación */}
                    {flow && flow.broker_commission?.reservation && !loadingPdfData && financialSummaryForPDF && (
                        <PDFDownloadLink
                            document={
                            <LiquidacionPagoBrokerPDF 
                                flowData={flow} 
                                appliedPromotions={appliedPromotions}
                                financialSummary={financialSummaryForPDF} 
                                formatDate={formatDateChile} 
                                formatCurrency={formatCurrency}
                            />
                            }
                            fileName={`Liquidacion_Broker_${flow.broker_commission.reservation.reservation_number || reservationId}.pdf`}
                            className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            {({ loading: pdfLoading }) =>
                            pdfLoading ? (
                                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Generando PDF...</>
                            ) : (
                                <><FileText className="h-5 w-5 mr-2" /> Descargar Liquidación</>
                            )
                            }
                        </PDFDownloadLink>
                    )}
                    {loadingPdfData && ( // Mostrar loader mientras se cargan datos para el PDF
                         <button className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-500 opacity-75 cursor-not-allowed" disabled>
                            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando datos PDF...
                        </button>
                    )}
                     <button onClick={navigateToDocuments} className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50" title="Documentos del Cliente"><Users className="h-5 w-5 mr-2" /> Documentos Cliente</button>
                     <button onClick={navigateToTaskTracking} className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50" title="Seguimiento de Tareas"><ClipboardList className="h-5 w-5 mr-2" /> Seguimiento Tareas</button>
                </div>
            </div>
            {/* --- FIN NUEVA TARJETA --- */}
            
            {/* Etapas y Tareas del Flujo */}
            {flow.stages.map((stage, stageIndex) => ( /* ... (código sin cambios, ya incluye la lógica de colapso) ... */ ))}
        </div>
      </div>
    </Layout>
  );
};

// AtRiskPopup (ya está en tu código)
// SummaryCard (ya está en tu código)

export default PaymentFlowPage;