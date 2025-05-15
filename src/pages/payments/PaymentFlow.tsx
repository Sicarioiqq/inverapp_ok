import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile, formatDateTimeChile, formatCurrency } from '../../lib/supabase'; // formatCurrency ya está aquí
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import { PDFDownloadLink } from '@react-pdf/renderer'; // Quitada BlobProvider si no se usa directamente
import LiquidacionPagoBrokerPDF from '../../components/pdf/LiquidacionPagoBrokerPDF'; // Ruta del usuario
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserCircle,
  UserPlus,
  MessageSquare,
  Play,
  Loader2,
  Calendar,
  AlertTriangle,
  Timer,
  Edit,
  ChevronDown,
  ChevronRight,
  Edit2,
  Users,
  ListChecks,
  FileText, // Para el botón PDF
  ClipboardList,
  DollarSign,
  Plus,
  Info, // Para la tarjeta de Info General
  TrendingUp, // Para Resumen Financiero
  Wallet,     // Para Resumen Financiero
  TrendingDown, // Para Resumen Financiero
  Minus,       // Para Resumen Financiero
  Gift        // Para la tarjeta de Informes (si la tuviera) o podría ser FileText
} from 'lucide-react';
import { differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import CommissionTaskCommentPopup from '../../components/CommissionTaskCommentPopup';
import CommissionTaskCommentList from '../../components/CommissionTaskCommentList';
// Asumo que AtRiskPopup se importa si handleToggleAtRisk se usa completamente
// import AtRiskPopup from '../../components/AtRiskPopup'; // Si es necesario


// --- INICIO: Definiciones de Tipos (Consistentes) ---
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

interface Task {
  id: string;
  commission_flow_task_id?: string;
  name: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  assigned_at?: string;
  expected_date?: string;
  days_to_complete?: number;
  assignee?: { id: string; first_name: string; last_name: string; avatar_url?: string; };
  default_assignee?: { id: string; first_name: string; last_name: string; avatar_url?: string; };
  comments_count: number;
  isCollapsed?: boolean;
}
interface Stage {
  id: string;
  name: string;
  tasks: Task[];
  isCompleted: boolean;
  isExpanded: boolean;
}
interface PaymentFlow {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  is_second_payment: boolean;
  flow: { id: string; };
  broker_commission: {
    id: string;
    commission_amount: number;
    number_of_payments: number;
    first_payment_percentage: number;
    at_risk: boolean;
    at_risk_reason: string | null;
    reservation: {
      id: string;
      reservation_number: string;
      total_payment?: number; // Necesario para financialSummary
      subsidy_payment?: number; // Necesario para financialSummary
      minimum_price?: number; // Necesario para financialSummary
      client: { id: string; first_name: string; last_name: string; rut: string; };
      project: { name: string; stage: string; };
      apartment_number: string;
      broker: { id: string; name: string; business_name: string;};
    };
  };
  current_stage: { id: string; name: string; } | null;
  stages: Stage[];
}
interface User {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  avatar_url?: string;
}
interface FinancialSummaryForPDF {
    totalPayment: number;
    recoveryPayment: number;
    minimumPrice: number;
    difference: number;
    totalCommissionUF: number;
    firstPaymentUF: number;
    secondPaymentUF?: number;
    totalPromotionsAgainstDiscount: number;
}
// --- FIN: Definiciones de Tipos ---


const retryOperation = async ( /* ... (código sin cambios) ... */ ): Promise<any> => { /* ... */ };

const PaymentFlowPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Este 'id' es el commission_flow_id
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const [flow, setFlow] = useState<PaymentFlow | null>(null);
  const [loading, setLoading] = useState(true);
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

  // --- NUEVOS ESTADOS para datos del PDF ---
  const [appliedPromotions, setAppliedPromotions] = useState<AppliedPromotion[]>([]);
  const [financialSummaryForPDF, setFinancialSummaryForPDF] = useState<FinancialSummaryForPDF | null>(null);


  useEffect(() => {
    if (id) { // id es commission_flow_id
      setLoading(true);
      // Primero cargar el flujo principal
      fetchFlow()
        .catch((err) => {
          console.error("Error en la carga inicial del flujo:", err);
          setError(err.message || "Error al cargar datos del flujo.");
          setLoading(false); // Asegurar que el loading pare si hay error aquí
        });
    } else {
      navigate('/pagos');
    }
  }, [id, commentRefreshTrigger]);

  // --- NUEVO useEffect para cargar datos dependientes una vez que 'flow' esté disponible ---
  useEffect(() => {
    const loadDependentData = async () => {
      if (flow && flow.broker_commission?.reservation?.id) {
        const reservationId = flow.broker_commission.reservation.id;
        // setLoading(true); // O un loader más específico para esta parte
        try {
          // Fetch Promociones
          const { data: promos, error: promoError } = await supabase
            .from('promotions')
            .select('*')
            .eq('reservation_id', reservationId)
            .order('created_at', { ascending: true });
          if (promoError) throw promoError;
          const currentPromotions = (promos as AppliedPromotion[]) || [];
          setAppliedPromotions(currentPromotions);

          // Calcular Resumen Financiero
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
          }
        } catch (err: any) {
          console.error("Error cargando datos dependientes para PDF:", err);
          setError(prev => prev ? `${prev}, ${err.message}`: err.message);
        } finally {
          // setLoading(false); // El loading general se maneja en el useEffect principal
        }
      }
    };

    if (flow) { // Solo ejecutar si flow ya tiene datos
        loadDependentData();
    }
  }, [flow]); // Se ejecuta cuando 'flow' cambia y tiene datos


  const checkAdminStatus = async () => { /* ... (sin cambios) ... */ };
  const fetchUsers = async () => { /* ... (sin cambios) ... */ };
  const fetchFlow = async () => { /* ... (lógica de fetchFlow sin la parte de setLoading y setError al inicio/final) ... */ 
    // setLoading(true); // Removido, se maneja en useEffect
    // setError(null);   // Removido, se maneja en useEffect
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
              id, reservation_number, apartment_number, total_payment, subsidy_payment, minimum_price, /*Asegurar estos campos para resumen*/
              client:clients(id, first_name, last_name, rut),
              project:projects(name, stage),
              broker:brokers(id, name, business_name)
            )
          )
        `)
        .eq('id', id) // 'id' aquí es el commission_flow_id
        .single();
      if (flowError) throw flowError;
      if (!flowData) throw new Error("Flujo de comisión no encontrado");

      const { data: stagesData, error: stagesError } = await supabase
        .from('payment_flow_stages')
        .select(`
          id, name, order,
          tasks:payment_flow_tasks(id, name, days_to_complete, default_assignee:profiles(id, first_name, last_name, avatar_url))
        `)
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
          .from('commission_task_comments')
          .select('commission_flow_task_id')
          .in('commission_flow_task_id', commissionFlowTaskIds);
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
            id: taskTemplate.id,
            commission_flow_task_id: flowTaskInstance?.id,
            name: taskTemplate.name,
            status: flowTaskInstance?.status || 'blocked',
            started_at: flowTaskInstance?.started_at,
            completed_at: flowTaskInstance?.completed_at,
            assigned_at: flowTaskInstance?.assigned_at,
            days_to_complete: taskTemplate.days_to_complete,
            assignee: flowTaskInstance?.assignee,
            default_assignee: taskTemplate.default_assignee,
            comments_count: taskCommentCount,
            isCollapsed: isCompleted, 
          };
        });
        return {
          id: stage.id, name: stage.name, tasks: stageTasks,
          isCompleted: stageTasks.every(task => task.status === 'completed'),
          isExpanded: true,
        };
      }) || [];
      setFlow({ ...flowData, stages });
    } catch (err) {
      throw err; // Propagar para que el useEffect lo capture
    }
    // finally { setLoading(false); } // Removido
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
  // formatDate y formatDateTime ya están importados
  const navigateToEditClient = () => { /* ... (sin cambios) ... */ };
  const navigateToEditReservation = () => { /* ... (sin cambios) ... */ };
  const navigateToEditCommission = () => { /* ... (sin cambios) ... */ };
  const navigateToReservationFlow = async () => { /* ... (sin cambios) ... */ };
  const navigateToDocuments = () => { /* ... (sin cambios) ... */ };
  const navigateToTaskTracking = () => { /* ... (sin cambios) ... */ };
  const handleCreateSecondPaymentFlow = async () => { /* ... (sin cambios) ... */ };
  const handleDateInputChange = async (e: React.ChangeEvent<HTMLInputElement>, templateTaskId: string, type: 'start' | 'complete') => { /* ... (sin cambios) ... */ };
  const handleToggleAtRisk = () => { /* ... (sin cambios) ... */ };

  // --- Componente auxiliar SummaryCard (si no lo tienes global) ---
  interface SummaryCardProps { title: string; value: number; icon: React.ReactNode; valueColor?: string; subtitle?: string; }
  const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, valueColor = 'text-gray-900', subtitle }) => (
    <div className={`p-4 rounded-lg shadow ${valueColor.includes('red') ? 'bg-red-50' : valueColor.includes('green') ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className="flex items-center mb-1"><span className="text-gray-500 mr-2">{icon}</span><h3 className="text-sm font-medium text-gray-700">{title}</h3></div>
      <div className={`text-xl font-bold ${valueColor}`}>{formatCurrency(value)} UF</div>
      {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
  );
  // --- Fin SummaryCard ---


  if (loading) { return <Layout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div></Layout>; }
  if (error) { return <Layout><div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">Error: {error}</div></Layout>; }
  if (!flow) { return <Layout><div className="p-4 text-center text-gray-500">No se encontró información para este flujo de pago.</div></Layout>; }

  const canCreateSecondPaymentFlow = flow.status === 'completed' && flow.broker_commission.number_of_payments === 2 && !flow.is_second_payment;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header y Navegación de Iconos */}
        <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/pagos')} className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-5 w-5 mr-2" /> Volver
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">
                {flow.is_second_payment ? 'Segundo Pago' : 'Flujo de Pago'} - Reserva {flow.broker_commission.reservation.reservation_number}
            </h1>
            <div className="flex space-x-1 md:space-x-2"> {/* Ajustado space-x para responsividad */}
                <button onClick={navigateToEditClient} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Cliente"><Users className="h-5 w-5" /></button>
                <button onClick={navigateToEditReservation} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Reserva"><Edit2 className="h-5 w-5" /></button>
                <button onClick={navigateToEditCommission} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Comisión"><DollarSign className="h-5 w-5" /></button>
                <button onClick={navigateToReservationFlow} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Flujo de Reserva"><ListChecks className="h-5 w-5" /></button>
                <button onClick={navigateToDocuments} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Documentos"><FileText className="h-5 w-5" /></button>
                {/* El botón de seguimiento ya no está aquí, se añade abajo */}
            </div>
        </div>
        
        <div className="space-y-6"> {/* Contenedor para las tarjetas */}
            {/* Información General y Estado del Proceso */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div> {/* Información General */}
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>
                        <dl className="space-y-2 text-sm">
                            <div><dt className="font-medium text-gray-500">Cliente</dt><dd className="text-gray-900">{flow.broker_commission.reservation.client.first_name} {flow.broker_commission.reservation.client.last_name}</dd></div>
                            <div><dt className="font-medium text-gray-500">Proyecto</dt><dd className="text-gray-900">{flow.broker_commission.reservation.project.name} {flow.broker_commission.reservation.project.stage} - {flow.broker_commission.reservation.apartment_number}</dd></div>
                            <div><dt className="font-medium text-gray-500">Broker</dt><dd className="text-gray-900">{flow.broker_commission.reservation.broker.name}</dd></div>
                            <div><dt className="font-medium text-gray-500">Monto Comisión</dt><dd className="text-gray-900">{flow.is_second_payment ? `${formatCurrency(((100 - flow.broker_commission.first_payment_percentage) / 100 * flow.broker_commission.commission_amount))} UF (${100 - flow.broker_commission.first_payment_percentage}%)` : `${formatCurrency(((flow.broker_commission.first_payment_percentage / 100) * flow.broker_commission.commission_amount))} UF (${flow.broker_commission.first_payment_percentage}%)`}</dd></div>
                            {flow.broker_commission.number_of_payments === 2 && (<div><dt className="font-medium text-gray-500">Tipo de Pago</dt><dd className="text-gray-900">{flow.is_second_payment ? 'Segundo Pago' : 'Primer Pago'}</dd></div>)}
                            {flow.broker_commission.at_risk && (<div><dt className="font-medium text-gray-500">Estado Riesgo</dt><dd className="text-sm flex items-center"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><AlertCircle className="h-4 w-4 mr-1" />En Riesgo</span>{flow.broker_commission.at_risk_reason && (<span className="ml-2 text-gray-500 italic">{flow.broker_commission.at_risk_reason}</span>)}</dd></div>)}
                        </dl>
                    </div>
                    <div> {/* Estado del Proceso */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Estado del Proceso</h2>
                            {/* ... (Botones de acción del flujo) ... */}
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
                <div className="flex flex-col sm:flex-row gap-4">
                    {flow && reservationId && !loading && financialSummaryForPDF && ( // Solo mostrar si hay datos y no está cargando
                        <PDFDownloadLink
                            document={
                            <LiquidacionPagoBrokerPDF 
                                flowData={flow} 
                                appliedPromotions={appliedPromotions} // Se pasa aunque LiquidacionPagoBrokerPDF podría no usarla directamente
                                // El financialSummary que se pasa aquí ya incluye el descuento de promociones
                                financialSummary={financialSummaryForPDF} 
                                formatDate={formatDateChile}
                                formatCurrency={formatCurrency}
                            />
                            }
                            fileName={`Liquidacion_Broker_${flow.broker_commission?.reservation?.reservation_number || reservationId}.pdf`}
                        >
                            {({ blob, url, loading: pdfLoading, error: pdfError }) =>
                            pdfLoading ? (
                                <button className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50" disabled>
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Generando PDF...
                                </button>
                            ) : (
                                <button className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                                    <FileText className="h-5 w-5 mr-2" /> Descargar Liquidación PDF
                                </button>
                            )
                            }
                        </PDFDownloadLink>
                    )}
                     {/* Aquí podrías agregar más botones para otros informes en el futuro */}
                     <button
                        onClick={navigateToTaskTracking}
                        className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        title="Seguimiento de Tareas"
                    >
                        <ClipboardList className="h-5 w-5 mr-2" /> Seguimiento de Tareas
                    </button>
                </div>
            </div>
            {/* --- FIN NUEVA TARJETA --- */}

            {/* Etapas y Tareas del Flujo */}
            <div className="space-y-6">
            {flow.stages.map((stage, stageIndex) => (
                <div id={`stage-${stage.id}`} key={stage.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b flex items-center justify-between cursor-pointer" onClick={() => toggleStage(stageIndex)}>
                    <div className="flex items-center">
                    {stage.isExpanded ? <ChevronDown className="h-5 w-5 mr-2" /> : <ChevronRight className="h-5 w-5 mr-2" />}
                    <h3 className="text-lg font-medium text-gray-900">{stage.name}</h3>
                    </div>
                    {stage.isCompleted && (<span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Completada</span>)}
                </div>
                {stage.isExpanded && (
                    <div className="divide-y divide-gray-200">
                    {stage.tasks.map((task, taskIndex) => {
                        const isTaskCompleted = task.status === 'completed';
                        const showCollapsedView = isTaskCompleted && task.isCollapsed;
                        const completionTime = task.completed_at && task.started_at ? getDaysElapsed(task.started_at, task.completed_at) : null;
                        const daysOverdue = getDaysOverdue(task);
                        
                        return (
                        <div key={task.id} className={`p-6 ${showCollapsedView ? 'py-3' : 'hover:bg-gray-50'}`}>
                            {showCollapsedView ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                <CheckCircle2 className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
                                <h4 className="text-base font-medium text-gray-700">{task.name}</h4>
                                </div>
                                <button onClick={() => toggleTaskCollapse(stageIndex, taskIndex)} className="p-1 text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50" title="Expandir tarea"><ChevronRight className="h-5 w-5" /></button>
                            </div>
                            ) : (
                            <>
                                <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                    <h4 className={`text-base font-medium ${isTaskCompleted ? 'text-gray-700' : 'text-gray-900'}`}>{task.name}</h4>
                                    {isTaskCompleted ? (
                                        <button onClick={() => toggleTaskCollapse(stageIndex, taskIndex)} className="p-1 text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50" title="Colapsar tarea"><ChevronDown className="h-5 w-5" /></button>
                                    ) : (
                                        <select value={task.status} onChange={(e) => handleStatusChange(task.id, e.target.value)} disabled={flow.status === 'pending'} className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.status)} border-0 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed`}>
                                        <option value="pending">Pendiente</option><option value="in_progress">En Proceso</option><option value="completed">Completada</option><option value="blocked">Bloqueada</option>
                                        </select>
                                    )}
                                    </div>
                                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                                    {task.assignee ? (<div className="flex items-center">{task.assignee.avatar_url ? <img src={task.assignee.avatar_url} alt={`${task.assignee.first_name} ${task.assignee.last_name}`} className="h-8 w-8 rounded-full object-cover"/> : <UserCircle className="h-8 w-8 text-gray-400" />}<span className="ml-2 text-sm text-gray-600">{task.assignee.first_name} {task.assignee.last_name}</span></div>
                                    ) : task.default_assignee ? (<button onClick={() => handleAssign(task.id, null, task.default_assignee)} className="flex items-center text-blue-600 hover:text-blue-800" disabled={flow.status === 'pending'}><UserPlus className="h-5 w-5 mr-1" /><span>Asignar a {task.default_assignee.first_name}</span></button>
                                    ) : (<button onClick={() => handleAssign(task.id, null, null)} className="flex items-center text-blue-600 hover:text-blue-800" disabled={flow.status === 'pending'}><UserPlus className="h-5 w-5 mr-1" /><span>Asignar</span></button>)}
                                    <button onClick={() => handleAddComment(task.commission_flow_task_id)} className="flex items-center text-gray-500 hover:text-gray-700 relative" disabled={flow.status === 'pending' || !task.commission_flow_task_id}><MessageSquare className="h-5 w-5 mr-1" /><span>Comentar</span>{task.comments_count > 0 && (<span className="absolute -top-1 -right-1 h-4 w-4 text-xs flex items-center justify-center bg-blue-600 text-white rounded-full">{task.comments_count}</span>)}</button>
                                    <button onClick={() => toggleTaskComments(task.commission_flow_task_id)} className="flex items-center text-gray-500 hover:text-gray-700" disabled={flow.status === 'pending' || task.comments_count === 0 || !task.commission_flow_task_id}><span>Ver comentarios</span> <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${expandedTaskId === task.commission_flow_task_id ? 'rotate-180' : ''}`} /></button>
                                    </div>
                                    <div className="mt-2 text-sm text-gray-500">
                                    {task.started_at && (
                                        <div className="flex flex-col space-y-2">
                                        <div className="flex items-center">{editingTaskDate && editingTaskDate.taskId === task.id && editingTaskDate.type === 'start' ? (<input type="datetime-local" defaultValue={task.started_at.split('.')[0]} onChange={(e) => handleDateInputChange(e, task.id, 'start')} className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/>) : (<div className="flex items-center"><Calendar className="h-4 w-4 mr-1" /><span>Iniciada el {formatDateTime(task.started_at)}</span>{isAdmin && (<button onClick={() => { setEditingTaskDate({ taskId: task.id, type: 'start' }); if(task.started_at){setTempDateValue(task.started_at.split('.')[0])}; }} className="ml-2 text-blue-600 hover:text-blue-800" title="Editar fecha de inicio"><Edit className="h-4 w-4" /></button>)}</div>)}</div>
                                        {task.completed_at && (<div className="flex items-center">{editingTaskDate && editingTaskDate.taskId === task.id && editingTaskDate.type === 'complete' ? (<input type="datetime-local" defaultValue={task.completed_at.split('.')[0]} onChange={(e) => handleDateInputChange(e, task.id, 'complete')} className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/>) : (<div className="flex items-center text-green-600"><CheckCircle2 className="h-4 w-4 mr-1" /><span>Completada el {formatDateTime(task.completed_at)}</span>{isAdmin && (<button onClick={() => { setEditingTaskDate({ taskId: task.id, type: 'complete' }); if(task.completed_at){setTempDateValue(task.completed_at.split('.')[0])}; }} className="ml-2 text-blue-600 hover:text-blue-800" title="Editar fecha de completado"><Edit className="h-4 w-4" /></button>)}</div>)}</div>)}
                                        {completionTime !== null && (<div className="flex items-center text-green-600"><Timer className="h-4 w-4 mr-1" /><span>Gestionado en {completionTime} {completionTime === 1 ? 'día' : 'días'}</span></div>)}
                                        {task.days_to_complete && !isTaskCompleted && daysOverdue > 0 && (<div className="flex items-center text-red-600"><AlertTriangle className="h-4 w-4 mr-1" /><span>{daysOverdue} {daysOverdue === 1 ? 'día' : 'días'} de retraso</span></div>)}
                                        {task.days_to_complete && (<div className="flex items-center"><Calendar className="h-4 w-4 mr-1 text-gray-400" /><span>Plazo: {task.days_to_complete} días</span></div>)}
                                        </div>
                                    )}
                                    </div>
                                </div>
                                </div>
                                {expandedTaskId === task.commission_flow_task_id && task.comments_count > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-200"><CommissionTaskCommentList taskId={task.commission_flow_task_id!} commissionFlowId={flow.id} refreshTrigger={commentRefreshTrigger} /></div>
                                )}
                            </>
                            )}
                        </div>
                        );
                    })}
                    </div>
                )}
                </div>
            ))}
            </div>
        </div>
      </div>
    </Layout>
  );
};

interface AtRiskPopupProps { /* ... (sin cambios) ... */ }
const AtRiskPopup: React.FC<AtRiskPopupProps> = ({ /* ... (sin cambios) ... */ }) => { /* ... (sin cambios) ... */ };

// Componente auxiliar para tarjetas de resumen financiero
interface SummaryCardProps { title: string; value: number; icon: React.ReactNode; valueColor?: string; subtitle?: string; }
const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, valueColor = 'text-gray-900', subtitle }) => ( /* ... (sin cambios) ... */ );

export default PaymentFlowPage;