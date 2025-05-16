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
  ClipboardList, DollarSign, Plus, Info, TrendingUp, Wallet, TrendingDown, Minus, Gift, Ban
} from 'lucide-react'; // Combinada
import { differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import CommissionTaskCommentPopup from '../../components/CommissionTaskCommentPopup';
import CommissionTaskCommentList from '../../components/CommissionTaskCommentList';

// --- INICIO: Definiciones de Tipos ---
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
      is_rescinded?: boolean; 
      rescinded_at?: string;
      rescinded_reason?: string;
      client: { id: string; first_name: string; last_name: string; rut: string;};
      project: { name: string; stage: string; };
      apartment_number: string;
      broker: { id: string; name: string; business_name: string; };
    };
  } | null; 
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

interface AtRiskPopupProps {
  commissionId: string;
  isAtRisk: boolean;
  reason: string | null;
  onSave: () => void;
  onClose: () => void;
}

const retryOperation = async (operation: () => Promise<any>, maxRetries: number = 3, initialDelay: number = 1000): Promise<any> => { /* ... (código sin cambios, ya lo tienes) ... */ };

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
      if (flow && flow.broker_commission && flow.broker_commission.reservation && flow.broker_commission.reservation.id) {
        const reservationId = flow.broker_commission.reservation.id;
        setLoadingPdfData(true); 
        try {
          const { data: promos, error: promoError } = await supabase
            .from('promotions').select('*').eq('reservation_id', reservationId).order('created_at', { ascending: true });
          if (promoError) throw promoError;
          const currentPromotions = (promos as AppliedPromotion[]) || [];
          setAppliedPromotions(currentPromotions);

          const commissionData = flow.broker_commission;
          const reservationData = flow.broker_commission.reservation;

          if (reservationData.total_payment !== undefined && 
              reservationData.subsidy_payment !== undefined &&
              reservationData.minimum_price !== undefined &&
              commissionData.commission_amount !== undefined) {

            const totalPaymentVal = reservationData.total_payment;
            const subsidyPaymentVal = reservationData.subsidy_payment;
            const recoveryPaymentVal = totalPaymentVal - subsidyPaymentVal;
            const minimumPriceVal = reservationData.minimum_price;
            const commissionAmountForCalc = commissionData.commission_amount;
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
          setError(prev => prev ? `${prev}\nError al cargar datos para PDF: ${err.message}` : `Error al cargar datos para PDF: ${err.message}`);
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

  const checkAdminStatus = async () => { /* ... (código como lo tienes) ... */ };
  const fetchUsers = async () => { /* ... (código como lo tienes) ... */ };
  
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
              total_payment, subsidy_payment, minimum_price,
              is_rescinded, rescinded_at, rescinded_reason,
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
        throw new Error(`Flujo de comisión con ID ${id} no encontrado.`);
      }
      // --- VERIFICACIÓN ADICIONAL ---
      if (!flowData.broker_commission) {
        setFlow(null); // Establecer flow a null si no hay comisión de broker
        throw new Error(`El flujo de comisión ${flowData.id} no tiene una comisión de broker asociada.`);
      }
       if (!flowData.broker_commission.reservation) {
        setFlow(null); // Establecer flow a null si no hay reserva asociada
        throw new Error(`La comisión del broker para el flujo ${flowData.id} no tiene una reserva asociada.`);
      }
      // --- FIN VERIFICACIÓN ---

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

  const handleStartFlow = async () => { /* ... (código como lo tienes) ... */ };
  const handleStartDateChange = async (date: string) => { /* ... (código como lo tienes) ... */ };
  const handleTaskDateChange = async (templateTaskId: string, date: string, type: 'start' | 'complete') => { /* ... (código como lo tienes) ... */ };
  const handleAssign = async (templateTaskId: string, currentAssignee: User | null, defaultAssignee: User | null) => { /* ... (código como lo tienes) ... */ };
  const assignUser = async (templateTaskId: string, user: User) => { /* ... (código como lo tienes) ... */ };
  
  useEffect(() => { // Auto-asignar (como lo tienes)
    if (flow?.status === 'in_progress') {
      flow.stages.forEach(stage =>
        stage.tasks.forEach(task => {
          if (!task.assignee && task.default_assignee) {
            assignUser(task.id, task.default_assignee);
          }
        })
      );
    }
  }, [flow]); // Ajustada dependencia a solo flow

  useEffect(() => { // Scroll (como lo tienes)
    if (!flow) return;
    const pendingStageId = flow.current_stage?.id || flow.stages.find(s => !s.isCompleted)?.id;
    if (pendingStageId) {
      const el = document.getElementById(`stage-${pendingStageId}`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
  }, [flow]);

  const handleStatusChange = async (templateTaskId: string, newStatus: string) => { /* ... (código como lo tienes) ... */ };
  const handleAddComment = async (taskInstanceId: string | undefined) => { /* ... (código como lo tienes) ... */ };
  const toggleTaskComments = (taskInstanceId: string | undefined) => { /* ... (código como lo tienes) ... */ };
  const toggleTaskCollapse = (stageIndex: number, taskIndex: number) => { /* ... (código como lo tienes) ... */ };
  const toggleStage = (stageIndex: number) => { /* ... (código como lo tienes) ... */ };
  const getStatusIcon = (status: string) => { /* ... (código como lo tienes) ... */ };
  const getStatusText = (status: string) => { /* ... (código como lo tienes) ... */ };
  const getStatusColor = (status: string) => { /* ... (código como lo tienes) ... */ };
  const calculateProgress = () => { /* ... (código como lo tienes) ... */ };
  const getDaysElapsed = (startDate?: string, endDate?: string) => { /* ... (código como lo tienes) ... */ };
  const getExpectedDate = (task: Task) => { /* ... (código como lo tienes) ... */ };
  const getDaysOverdue = (task: Task) => { /* ... (código como lo tienes) ... */ };
  
  const navigateToEditClient = () => { if (flow?.broker_commission?.reservation?.client?.id) navigate(`/clientes/editar/${flow.broker_commission.reservation.client.id}`); };
  const navigateToEditReservation = () => { if (flow?.broker_commission?.reservation?.id) navigate(`/reservas/editar/${flow.broker_commission.reservation.id}`); };
  const navigateToEditCommission = () => { if (flow?.broker_commission?.reservation?.id) navigate(`/pagos/${flow.broker_commission.reservation.id}`); };
  const navigateToReservationFlow = async () => { if (!flow?.broker_commission?.reservation?.id) return; try { const { data, error: fetchError } = await supabase.from('reservation_flows').select('id').eq('reservation_id', flow.broker_commission.reservation.id).single(); if (fetchError) throw fetchError; if (data) navigate(`/flujo-reservas/${data.id}`); } catch (err: any) { setError(err.message); }};
  const navigateToDocuments = () => { /* ... (código como lo tienes) ... */ };
  const navigateToTaskTracking = () => { /* ... (código como lo tienes) ... */ };
  const handleCreateSecondPaymentFlow = async () => { /* ... (código como lo tienes) ... */ };
  const handleDateInputChange = async (e: React.ChangeEvent<HTMLInputElement>, templateTaskId: string, type: 'start' | 'complete') => { /* ... (código como lo tienes) ... */ };
  
  const AtRiskPopup: React.FC<AtRiskPopupProps> = ({ commissionId, isAtRisk, reason, onSave, onClose }) => {
    const { hidePopup } = usePopup();
    const [popupLoading, setPopupLoading] = useState(false); // Estado de carga específico para el popup
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
          .update({ at_risk: currentAtRisk, at_risk_reason: currentAtRisk ? currentReason.trim() : null })
          .eq('id', commissionId);
        if (updateError) throw updateError;
        hidePopup();
        onSave(); 
      } catch (err: any) { setPopupError(err.message); }
      finally { setPopupLoading(false); }
    };
  
    return (
      <form onSubmit={handlePopupSubmit} className="space-y-6">
        {popupError && (<div className="bg-red-50 text-red-600 p-4 rounded-lg">{popupError}</div>)}
        <div className="space-y-4">
          <div className="flex items-center">
            <input type="checkbox" id="popup_at_risk_flow_page" checked={currentAtRisk} onChange={(e) => setCurrentAtRisk(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>
            <label htmlFor="popup_at_risk_flow_page" className="ml-2 block text-sm text-gray-700">Marcar como En Riesgo</label>
          </div>
          {currentAtRisk && (
            <div>
              <label htmlFor="popup_at_risk_reason_flow_page" className="block text-sm font-medium text-gray-700">Motivo del Riesgo *</label>
              <textarea id="popup_at_risk_reason_flow_page" name="popup_at_risk_reason_flow_page" rows={3} required={currentAtRisk} value={currentReason} onChange={(e) => setCurrentReason(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="Describa el motivo..."/>
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

  const handleToggleAtRisk = () => {
    if (!flow?.broker_commission) return;
    showPopup( <AtRiskPopup commissionId={flow.broker_commission.id} isAtRisk={flow.broker_commission.at_risk || false} reason={flow.broker_commission.at_risk_reason || ''} onSave={fetchFlow} onClose={() => showPopup(null)} />,
      { title: flow.broker_commission.at_risk ? 'Editar Estado En Riesgo' : 'Marcar Como En Riesgo', size: 'md' }
    );
  };
  
  // --- Componente auxiliar SummaryCard (localmente si no lo tienes global o importado) ---
  interface SummaryCardProps { title: string; value: number | string; icon: React.ReactNode; valueColor?: string; subtitle?: string; }
  const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, valueColor = 'text-gray-900', subtitle }) => (
    <div className={`p-4 rounded-lg shadow ${valueColor.includes('red') ? 'bg-red-50' : valueColor.includes('green') ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className="flex items-center mb-1"><span className="text-gray-500 mr-2">{icon}</span><h3 className="text-sm font-medium text-gray-700">{title}</h3></div>
      <div className={`text-xl font-bold ${valueColor}`}>{typeof value === 'number' ? `${formatCurrency(value)} UF` : value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
  );
  // --- Fin SummaryCard ---

  // --- MODIFICACIÓN: Guardas de renderizado ---
  if (loading) { 
    return <Layout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div></Layout>; 
  }
  if (error) { // Si hay un error general de carga del flujo.
    return <Layout><div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">Error: {error} <button onClick={() => navigate('/pagos')} className="ml-4 text-blue-600 hover:underline">Volver a Pagos</button></div></Layout>; 
  }
  if (!flow) { // Si después de cargar, flow sigue siendo null (no encontrado o error en fetchFlow que lo seteó a null).
    return <Layout><div className="p-4 text-center text-gray-500">No se encontró información para este flujo de pago. <button onClick={() => navigate('/pagos')} className="text-blue-600 hover:underline">Volver a Pagos</button></div></Layout>; 
  }
  // A partir de aquí, 'flow' existe. Ahora verificamos las propiedades anidadas necesarias.
  const reservationDetails = flow.broker_commission?.reservation;
  const commissionDetails = flow.broker_commission;

  if (!commissionDetails || !reservationDetails) {
    return <Layout><div className="p-4 text-center text-gray-500">Datos de comisión o reserva faltantes para este flujo. <button onClick={() => navigate('/pagos')} className="text-blue-600 hover:underline">Volver a Pagos</button></div></Layout>;
  }
  // --- FIN MODIFICACIÓN GUARDAS ---

  const canCreateSecondPaymentFlow = flow.status === 'completed' && commissionDetails.number_of_payments === 2 && !flow.is_second_payment;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto pb-12">
        <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/pagos')} className="flex items-center text-gray-600 hover:text-gray-900"><ArrowLeft className="h-5 w-5 mr-2" /> Volver</button>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900 text-center">
                {flow.is_second_payment ? 'Segundo Pago' : 'Flujo de Pago'} - Reserva {reservationDetails.reservation_number}
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
                            <div><dt className="font-medium text-gray-500">Cliente</dt><dd className="text-gray-800">{reservationDetails.client?.first_name} {reservationDetails.client?.last_name}</dd></div>
                            <div><dt className="font-medium text-gray-500">Proyecto</dt><dd className="text-gray-800">{reservationDetails.project?.name} {reservationDetails.project?.stage} - {reservationDetails.apartment_number}</dd></div>
                            <div><dt className="font-medium text-gray-500">Broker</dt><dd className="text-gray-800">{reservationDetails.broker?.name}</dd></div>
                            <div><dt className="font-medium text-gray-500">Monto Comisión</dt><dd className="text-gray-800 font-semibold">{flow.is_second_payment ? `${formatCurrency(((100 - commissionDetails.first_payment_percentage) / 100 * commissionDetails.commission_amount))} UF (${100 - commissionDetails.first_payment_percentage}%)` : `${formatCurrency(((commissionDetails.first_payment_percentage / 100) * commissionDetails.commission_amount))} UF (${commissionDetails.first_payment_percentage}%)`}</dd></div>
                            {commissionDetails.number_of_payments === 2 && (<div><dt className="font-medium text-gray-500">Tipo de Pago</dt><dd className="text-gray-800">{flow.is_second_payment ? 'Segundo Pago' : 'Primer Pago'}</dd></div>)}
                            {commissionDetails.at_risk && (<div><dt className="font-medium text-gray-500">Estado Riesgo</dt><dd className="flex items-center"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><AlertCircle className="h-4 w-4 mr-1" />En Riesgo</span>{commissionDetails.at_risk_reason && (<span className="ml-2 text-gray-600 italic text-xs">{commissionDetails.at_risk_reason}</span>)}</dd></div>)}
                        </dl>
                    </div>
                    <div> 
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center"><Clock className="h-5 w-5 mr-2 text-blue-600"/>Estado del Proceso</h2>
                            <div className="flex space-x-2">
                                {isAdmin && flow.status === 'pending' && (<button onClick={handleStartFlow} disabled={startingFlow} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{startingFlow ? <Loader2 className="animate-spin h-4 w-4" /> : <><Play className="h-4 w-4 mr-1" />Proceder</>}</button>)}
                                {canCreateSecondPaymentFlow && (<button onClick={handleCreateSecondPaymentFlow} disabled={creatingSecondFlow} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">{creatingSecondFlow ? <Loader2 className="animate-spin h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" />2do Pago</>}</button>)}
                                {flow.status === 'in_progress' && !commissionDetails.at_risk && (<button onClick={handleToggleAtRisk} disabled={markingAtRisk} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50">{markingAtRisk ? <Loader2 className="animate-spin h-4 w-4" /> : <><AlertCircle className="h-4 w-4 mr-1" />En Riesgo</>}</button>)}
                                {flow.status === 'in_progress' && commissionDetails.at_risk && (<button onClick={handleToggleAtRisk} disabled={markingAtRisk} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{markingAtRisk ? <Loader2 className="animate-spin h-4 w-4" /> : <><Edit className="h-4 w-4 mr-1" />Editar Riesgo</>}</button>)}
                            </div>
                        </div>
                        <div className="space-y-3 text-sm">
                            {/* ... (resto del contenido de Estado del Proceso) ... */}
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
                    {/* --- MODIFICACIÓN: Condiciones más robustas para el PDFDownloadLink --- */}
                    {flow && flow.broker_commission && flow.broker_commission.reservation && !loadingPdfData && financialSummaryForPDF && (
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
                            fileName={`Liquidacion_Broker_${flow.broker_commission.reservation.reservation_number}.pdf`}
                            className="flex items-center justify-center w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            {({ loading: pdfLoading }) =>
                            pdfLoading ? ( <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Generando...</> ) : 
                                         ( <><FileText className="h-5 w-5 mr-2" /> Descargar Liquidación</> )
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
            <div className="space-y-6">
              {/* --- MODIFICACIÓN: Se elimina el comentario erróneo de aquí --- */}
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
                              {stage.tasks.map((task, taskIndex) => { // El error NO estaba en este map interno
                                  const isTaskCompleted = task.status === 'completed';
                                  const showCollapsedView = isTaskCompleted && (task.isCollapsed === undefined ? true : task.isCollapsed);
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
                                                {/* ... (Aquí va toda tu lógica existente para mostrar la tarea expandida, la he omitido por brevedad pero debe estar aquí) ... */}
                                                {/* Ejemplo de cómo comenzaría: */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h4 className={`text-base font-medium ${isTaskCompleted ? 'text-gray-700' : 'text-gray-900'}`}>{task.name}</h4>
                                                            {/* ... resto del encabezado de la tarea expandida ... */}
                                                        </div>
                                                        {/* ... resto de los detalles de la tarea expandida ... */}
                                                    </div>
                                                </div>
                                                {expandedTaskId === task.commission_flow_task_id && task.comments_count > 0 && ( // Usa commission_flow_task_id si es el correcto para los comentarios
                                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                                        <CommissionTaskCommentList
                                                        taskId={task.commission_flow_task_id!} // Asegúrate que este ID es el correcto para los comentarios
                                                        commissionFlowId={flow.id}
                                                        refreshTrigger={commentRefreshTrigger}
                                                        />
                                                    </div>
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

// AtRiskPopup (la definición que ya tienes)
// const AtRiskPopup: React.FC<AtRiskPopupProps> = ({ ... }) => { ... };

export default PaymentFlowPage;