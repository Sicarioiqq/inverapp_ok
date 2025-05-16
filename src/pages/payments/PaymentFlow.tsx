import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile, formatDateTimeChile, formatCurrency } from '../../lib/supabase';
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import { PDFDownloadLink } from '@react-pdf/renderer';
import LiquidacionPagoBrokerPDF from '../../components/pdf/LiquidacionPagoBrokerPDF';
import {
  ArrowLeft, Clock, CheckCircle2, AlertCircle, UserCircle, UserPlus,
  MessageSquare, Play, Loader2, Calendar, AlertTriangle, Timer, Edit,
  ChevronDown, ChevronRight, Edit2, Users, ListChecks, FileText,
  ClipboardList, DollarSign, Plus, Info, TrendingUp, Wallet, TrendingDown, Minus, Gift, Ban // Ban para Rescindir
} from 'lucide-react'; // Importaciones de lucide-react combinadas y corregidas
import { differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import CommissionTaskCommentPopup from '../../components/CommissionTaskCommentPopup';
import CommissionTaskCommentList from '../../components/CommissionTaskCommentList';

// --- INICIO: Definiciones de Tipos (Consistentes con otros archivos) ---
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
      total_payment?: number; 
      subsidy_payment?: number; 
      minimum_price?: number; 
      client: { id: string; first_name: string; last_name: string; rut: string;};
      project: { name: string; stage: string; };
      apartment_number: string;
      broker: { id: string; name: string; business_name: string; };
      is_rescinded?: boolean; // Añadido para verificar si la reserva está rescindida
      rescinded_reason?: string;
      rescinded_at?: string;
    };
  };
  current_stage: { id: string; name: string; } | null;
  stages: Stage[];
}
interface User {
  id: string; first_name: string; last_name: string; position: string; avatar_url?: string;
}
interface FinancialSummaryForPDF {
    totalPayment: number; recoveryPayment: number; minimumPrice: number;
    difference: number; totalCommissionUF: number; firstPaymentUF: number;
    secondPaymentUF?: number; totalPromotionsAgainstDiscount: number;
}
// --- FIN: Definiciones de Tipos ---

// AtRiskPopupProps debe definirse si AtRiskPopup se usa o importa
interface AtRiskPopupProps {
  commissionId: string;
  isAtRisk: boolean;
  reason: string | null; // Puede ser null
  onSave: () => void;
  onClose: () => void;
}

// Componente AtRiskPopup (si no está en un archivo separado, debe definirse aquí)
// Por simplicidad y para no alargar demasiado, asumo que lo tienes en un archivo separado y lo importarías.
// Si no, deberías pegar el código del componente AtRiskPopup aquí.
// Ejemplo: import AtRiskPopup from '../../components/AtRiskPopup';


const retryOperation = async (operation: () => Promise<any>, maxRetries: number = 3, initialDelay: number = 1000): Promise<any> => {
  let retries = 0;
  let delay = initialDelay;
  while (true) {
    try { return await operation(); } catch (error: any) {
      const isRetryableError = error?.message?.includes('cannot ALTER TABLE') || error?.code === '55006';
      if (retries >= maxRetries || !isRetryableError) { throw error; }
      retries++; console.log(`Retry attempt ${retries}/${maxRetries} after ${delay}ms delay...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
};

const PaymentFlowPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
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
      setError(null); 
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
        setError(null); 
        try {
          const { data: promos, error: promoError } = await supabase
            .from('promotions').select('*').eq('reservation_id', reservationId).order('created_at', { ascending: true });
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
            const totalPromosAgainstDiscount = currentPromotions.reduce((sum, promo) => promo.is_against_discount ? sum + (promo.amount || 0) : sum, 0);
            const differenceVal = recoveryPaymentVal - minimumPriceVal - commissionAmountForCalc - totalPromosAgainstDiscount;
            const firstPaymentUFCalc = commissionAmountForCalc * (commissionData.first_payment_percentage / 100);
            const secondPaymentUFCalc = commissionData.number_of_payments === 2 ? commissionAmountForCalc - firstPaymentUFCalc : 0;

            setFinancialSummaryForPDF({
              totalPayment: totalPaymentVal, recoveryPayment: recoveryPaymentVal, minimumPrice: minimumPriceVal,
              difference: differenceVal, totalCommissionUF: commissionAmountForCalc,
              firstPaymentUF: firstPaymentUFCalc, secondPaymentUF: secondPaymentUFCalc,
              totalPromotionsAgainstDiscount: totalPromosAgainstDiscount,
            });
          } else { setFinancialSummaryForPDF(null); }
        } catch (err: any) {
          console.error("Error cargando datos dependientes para PDF:", err);
          setError(prev => prev ? `${prev}, ${err.message}`: `Error al cargar datos para PDF: ${err.message}`);
          setAppliedPromotions([]); 
          setFinancialSummaryForPDF(null);
        } finally { setLoadingPdfData(false); }
      } else if (flow) { 
          setLoadingPdfData(false); 
          setAppliedPromotions([]);
          setFinancialSummaryForPDF(null);
      }
    };
    if (flow) { loadDependentData(); }
  }, [flow]); 

  const checkAdminStatus = async () => { /* ... (código sin cambios) ... */ };
  const fetchUsers = async () => { /* ... (código sin cambios) ... */ };
  
  const fetchFlow = async () => {
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
              total_payment, subsidy_payment, minimum_price, /* CAMPOS PARA RESUMEN FINANCIERO */
              is_rescinded, rescinded_at, rescinded_reason, /* CAMPOS DE RESCILIACIÓN */
              client:clients(id, first_name, last_name, rut),
              project:projects(name, stage),
              broker:brokers(id, name, business_name)
            )
          )
        `)
        .eq('id', id)
        .single();
      
      if (flowError) throw flowError;
      if (!flowData) {
        setFlow(null); 
        throw new Error("Flujo de comisión no encontrado.");
      }
      if (!flowData.broker_commission || !flowData.broker_commission.reservation) {
        setFlow(null);
        throw new Error("Datos de comisión o reserva asociados al flujo son incompletos.");
      }

      const { data: stagesData, error: stagesError } = await supabase
        .from('payment_flow_stages').select(`id, name, order, tasks:payment_flow_tasks(id, name, days_to_complete, default_assignee:profiles(id, first_name, last_name, avatar_url))`)
        .eq('flow_id', flowData.flow.id).order('order', { ascending: true });
      if (stagesError) throw stagesError;

      const { data: flowTasks, error: tasksError } = await supabase
        .from('commission_flow_tasks').select(`id, task_id, status, started_at, completed_at, assigned_at, assignee:profiles(id, first_name, last_name, avatar_url)`)
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
      commentsData.forEach(comment => { if (comment.commission_flow_task_id) { commentCounts[comment.commission_flow_task_id] = (commentCounts[comment.commission_flow_task_id] || 0) + 1; } });

      const stages = stagesData?.map(stage => {
        const stageTasks = stage.tasks.map(taskTemplate => {
          const flowTaskInstance = flowTasks?.find(ft => ft.task_id === taskTemplate.id);
          return {
            id: taskTemplate.id, commission_flow_task_id: flowTaskInstance?.id, name: taskTemplate.name,
            status: flowTaskInstance?.status || 'blocked', started_at: flowTaskInstance?.started_at,
            completed_at: flowTaskInstance?.completed_at, assigned_at: flowTaskInstance?.assigned_at,
            days_to_complete: taskTemplate.days_to_complete, assignee: flowTaskInstance?.assignee,
            default_assignee: taskTemplate.default_assignee, 
            comments_count: flowTaskInstance ? (commentCounts[flowTaskInstance.id] || 0) : 0,
            isCollapsed: flowTaskInstance?.status === 'completed', 
          };
        });
        return { id: stage.id, name: stage.name, tasks: stageTasks, isCompleted: stageTasks.every(task => task.status === 'completed'), isExpanded: true };
      }) || [];
      setFlow({ ...flowData, stages } as PaymentFlow);
    } catch (err) {
      setFlow(null); 
      throw err; 
    }
  };

  const handleStartFlow = async () => { /* ... (código sin cambios) ... */ };
  const handleStartDateChange = async (date: string) => { /* ... (código sin cambios) ... */ };
  const handleTaskDateChange = async (templateTaskId: string, date: string, type: 'start' | 'complete') => { /* ... (código sin cambios) ... */ };
  const handleAssign = async (templateTaskId: string, currentAssignee: User | null, defaultAssignee: User | null) => { /* ... (código sin cambios) ... */ };
  const assignUser = async (templateTaskId: string, user: User) => { /* ... (código sin cambios) ... */ };
  // useEffect para auto-asignar (sin cambios)
  // useEffect para scroll (sin cambios)
  const handleStatusChange = async (templateTaskId: string, newStatus: string) => { /* ... (código sin cambios) ... */ };
  const handleAddComment = async (taskInstanceId: string | undefined) => { /* ... (código sin cambios) ... */ };
  const toggleTaskComments = (taskInstanceId: string | undefined) => { /* ... (código sin cambios) ... */ };
  const toggleTaskCollapse = (stageIndex: number, taskIndex: number) => { /* ... (código sin cambios) ... */ };
  const toggleStage = (stageIndex: number) => { /* ... (código sin cambios) ... */ };
  const getStatusIcon = (status: string) => { /* ... (código sin cambios) ... */ };
  const getStatusText = (status: string) => { /* ... (código sin cambios) ... */ };
  const getStatusColor = (status: string) => { /* ... (código sin cambios) ... */ };
  const calculateProgress = () => { /* ... (código sin cambios) ... */ };
  const getDaysElapsed = (startDate?: string, endDate?: string) => { /* ... (código sin cambios) ... */ };
  const getExpectedDate = (task: Task) => { /* ... (código sin cambios) ... */ };
  const getDaysOverdue = (task: Task) => { /* ... (código sin cambios) ... */ };
  // formatDate, formatDateTime, formatCurrency ya están importados
  const navigateToEditClient = () => { /* ... (código sin cambios) ... */ };
  const navigateToEditReservation = () => { /* ... (código sin cambios) ... */ };
  const navigateToEditCommission = () => { /* ... (código sin cambios) ... */ };
  const navigateToReservationFlow = async () => { /* ... (código sin cambios) ... */ };
  const navigateToDocuments = () => { /* ... (código sin cambios) ... */ };
  const navigateToTaskTracking = () => { /* ... (código sin cambios) ... */ };
  const handleCreateSecondPaymentFlow = async () => { /* ... (código sin cambios) ... */ };
  const handleDateInputChange = async (e: React.ChangeEvent<HTMLInputElement>, templateTaskId: string, type: 'start' | 'complete') => { /* ... (código sin cambios) ... */ };
  
  // --- MODIFICACIÓN: Definición de AtRiskPopup (si no se importa) ---
  const AtRiskPopup: React.FC<AtRiskPopupProps> = ({ commissionId, isAtRisk, reason, onSave, onClose }) => {
      const { hidePopup } = usePopup();
      const [popupLoading, setPopupLoading] = useState(false);
      const [popupError, setPopupError] = useState<string | null>(null);
      const [currentAtRisk, setCurrentAtRisk] = useState(isAtRisk);
      const [currentReason, setCurrentReason] = useState(reason || '');

      const handlePopupSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          if (popupLoading) return;
          try {
              setPopupLoading(true); setPopupError(null);
              const { error: updateError } = await supabase
                  .from('broker_commissions')
                  .update({ at_risk: currentAtRisk, at_risk_reason: currentAtRisk ? currentReason : null })
                  .eq('id', commissionId);
              if (updateError) throw updateError;
              hidePopup();
              onSave(); // Llama a fetchFlow para recargar
          } catch (err: any) { setPopupError(err.message); }
          finally { setPopupLoading(false); }
      };
      return (
          <form onSubmit={handlePopupSubmit} className="space-y-6">
              {popupError && (<div className="bg-red-50 text-red-600 p-4 rounded-lg">{popupError}</div>)}
              <div className="space-y-4">
                  <div className="flex items-center">
                      <input type="checkbox" id="popup_at_risk" checked={currentAtRisk} onChange={(e) => setCurrentAtRisk(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>
                      <label htmlFor="popup_at_risk" className="ml-2 block text-sm text-gray-700">Marcar como En Riesgo</label>
                  </div>
                  {currentAtRisk && (
                      <div>
                          <label htmlFor="popup_at_risk_reason" className="block text-sm font-medium text-gray-700">Motivo del Riesgo *</label>
                          <textarea id="popup_at_risk_reason" name="popup_at_risk_reason" rows={3} required={currentAtRisk} value={currentReason} onChange={(e) => setCurrentReason(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="Describa el motivo..."/>
                      </div>
                  )}
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={() => { hidePopup(); onClose(); }} disabled={popupLoading} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
                  <button type="submit" disabled={popupLoading} className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                      {popupLoading ? (<><Loader2 className="animate-spin h-5 w-5 mr-2" />Guardando...</>) : ('Guardar')}
                  </button>
              </div>
          </form>
      );
  };
  // --- FIN AtRiskPopup ---
  
  const handleToggleAtRisk = () => {
    if (!flow?.broker_commission) return; // Asegurarse que broker_commission exista
    showPopup(
      <AtRiskPopup 
        commissionId={flow.broker_commission.id} 
        isAtRisk={flow.broker_commission.at_risk || false} 
        reason={flow.broker_commission.at_risk_reason || ''} 
        onSave={fetchFlow} // fetchFlow recargará todo, incluyendo el estado de riesgo
        onClose={() => showPopup(null)} // Cierra el popup si se cancela
      />,
      { title: flow.broker_commission.at_risk ? 'Editar Estado En Riesgo' : 'Marcar Como En Riesgo', size: 'md' }
    );
  };


  // --- Componente auxiliar SummaryCard (si no lo tienes global) ---
  interface SummaryCardProps { title: string; value: number | string; icon: React.ReactNode; valueColor?: string; subtitle?: string; }
  const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, valueColor = 'text-gray-900', subtitle }) => (
    <div className={`p-4 rounded-lg shadow ${valueColor.includes('red') ? 'bg-red-50' : valueColor.includes('green') ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className="flex items-center mb-1"><span className="text-gray-500 mr-2">{icon}</span><h3 className="text-sm font-medium text-gray-700">{title}</h3></div>
      <div className={`text-xl font-bold ${valueColor}`}>{typeof value === 'number' ? `${formatCurrency(value)} UF` : value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
  );
  // --- Fin SummaryCard ---


  if (loading) { /* ... (sin cambios) ... */ }
  if (error) { /* ... (sin cambios) ... */ }
  if (!flow) { /* ... (sin cambios) ... */ }

  const canCreateSecondPaymentFlow = flow.status === 'completed' && flow.broker_commission?.number_of_payments === 2 && !flow.is_second_payment;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto pb-12"> {/* Añadido pb-12 para espacio al final */}
        <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/pagos')} className="flex items-center text-gray-600 hover:text-gray-900"><ArrowLeft className="h-5 w-5 mr-2" /> Volver</button>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900 text-center">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div> 
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center"><Info className="h-5 w-5 mr-2 text-blue-600"/>Información General</h2>
                        <dl className="space-y-1 text-sm">
                            <div><dt className="font-medium text-gray-500">Cliente</dt><dd className="text-gray-800">{flow.broker_commission?.reservation?.client?.first_name} {flow.broker_commission?.reservation?.client?.last_name}</dd></div>
                            <div><dt className="font-medium text-gray-500">Proyecto</dt><dd className="text-gray-800">{flow.broker_commission?.reservation?.project?.name} {flow.broker_commission?.reservation?.project?.stage} - {flow.broker_commission?.reservation?.apartment_number}</dd></div>
                            <div><dt className="font-medium text-gray-500">Broker</dt><dd className="text-gray-800">{flow.broker_commission?.reservation?.broker?.name}</dd></div>
                            <div><dt className="font-medium text-gray-500">Monto Comisión</dt><dd className="text-gray-800 font-semibold">{flow.is_second_payment ? `${formatCurrency(((100 - (flow.broker_commission?.first_payment_percentage || 0)) / 100 * (flow.broker_commission?.commission_amount || 0)))} UF (${100 - (flow.broker_commission?.first_payment_percentage || 0)}%)` : `${formatCurrency((((flow.broker_commission?.first_payment_percentage || 0) / 100) * (flow.broker_commission?.commission_amount || 0)))} UF (${flow.broker_commission?.first_payment_percentage || 0}%)`}</dd></div>
                            {flow.broker_commission?.number_of_payments === 2 && (<div><dt className="font-medium text-gray-500">Tipo de Pago</dt><dd className="text-gray-800">{flow.is_second_payment ? 'Segundo Pago' : 'Primer Pago'}</dd></div>)}
                            {flow.broker_commission?.at_risk && (<div><dt className="font-medium text-gray-500">Estado Riesgo</dt><dd className="flex items-center"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><AlertCircle className="h-4 w-4 mr-1" />En Riesgo</span>{flow.broker_commission.at_risk_reason && (<span className="ml-2 text-gray-600 italic text-xs">{flow.broker_commission.at_risk_reason}</span>)}</dd></div>)}
                        </dl>
                    </div>
                    <div> 
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center"><Clock className="h-5 w-5 mr-2 text-blue-600"/>Estado del Proceso</h2>
                            <div className="flex space-x-2">
                                {isAdmin && flow.status === 'pending' && (<button onClick={handleStartFlow} disabled={startingFlow} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{startingFlow ? <Loader2 className="animate-spin h-4 w-4" /> : <><Play className="h-4 w-4 mr-1" />Proceder</>}</button>)}
                                {canCreateSecondPaymentFlow && (<button onClick={handleCreateSecondPaymentFlow} disabled={creatingSecondFlow} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">{creatingSecondFlow ? <Loader2 className="animate-spin h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" />2do Pago</>}</button>)}
                                {flow.status === 'in_progress' && !flow.broker_commission?.at_risk && (<button onClick={handleToggleAtRisk} disabled={markingAtRisk} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50">{markingAtRisk ? <Loader2 className="animate-spin h-4 w-4" /> : <><AlertCircle className="h-4 w-4 mr-1" />En Riesgo</>}</button>)}
                                {flow.status === 'in_progress' && flow.broker_commission?.at_risk && (<button onClick={handleToggleAtRisk} disabled={markingAtRisk} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{markingAtRisk ? <Loader2 className="animate-spin h-4 w-4" /> : <><Edit className="h-4 w-4 mr-1" />Editar Riesgo</>}</button>)}
                            </div>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div><div className="flex justify-between font-medium text-gray-500 mb-0.5"><span>Progreso</span><span>{Math.round(calculateProgress())}%</span></div><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${calculateProgress()}%` }}></div></div></div>
                            <div><dt className="font-medium text-gray-500">Iniciado</dt><dd className="text-gray-800">{flow.started_at ? (<div className="flex items-center text-xs">{editingStartDate ? (<input type="datetime-local" defaultValue={flow.started_at.split('.')[0]} onChange={(e) => handleStartDateChange(e.target.value)} className="text-xs border-gray-300 rounded-md" />) : (<><span>{formatDateTime(flow.started_at)}</span>{isAdmin && (<button onClick={() => setEditingStartDate(true)} className="ml-1.5 text-blue-600 hover:text-blue-800" title="Editar fecha"><Edit className="h-3 w-3" /></button>)}</>)}</div>) : (<span className="text-gray-500">No iniciado</span>)}</dd></div>
                            {flow.completed_at && (<div><dt className="font-medium text-gray-500">Completado</dt><dd className="text-gray-800 text-xs">{formatDateTime(flow.completed_at)}</dd></div>)}
                            <div><dt className="font-medium text-gray-500">Días Transcurridos</dt><dd className="text-gray-800">{getDaysElapsed(flow.started_at || undefined, flow.completed_at)} días</dd></div>
                            <div><dt className="font-medium text-gray-500">Etapa Actual</dt><dd className="text-gray-800">{flow.current_stage?.name || 'No iniciado'}</dd></div>
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
                    {flow && flow.broker_commission?.reservation?.id && !loadingPdfData && financialSummaryForPDF && (
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
                            fileName={`Liquidacion_Broker_${flow.broker_commission?.reservation?.reservation_number || id}.pdf`}
                            className="flex items-center justify-center w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
                    {loadingPdfData && !financialSummaryForPDF && ( 
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
                                const showCollapsedView = isTaskCompleted && (task.isCollapsed === undefined ? true : task.isCollapsed); // Default to collapsed if undefined
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
                                    ) : ( /* Contenido de tarea expandida */ <> {/* ... (tu lógica de renderizado de tarea expandida va aquí, igual a la anterior) ... */} </> )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>
    </Layout>
  );
};

// AtRiskPopup (ya está definido en tu código)
// const AtRiskPopup: React.FC<AtRiskPopupProps> = ({ ... }) => { ... };

export default PaymentFlowPage;