import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, formatDateChile, formatDateTimeChile, formatCurrency } from '../../lib/supabase'; // formatCurrency importado
import { usePopup } from '../../contexts/PopupContext';
import Layout from '../../components/Layout';
import { PDFDownloadLink } from '@react-pdf/renderer'; // Importación para PDF
import LiquidacionPagoBrokerPDF from '../../components/pdf/LiquidacionPagoBrokerPDF'; // Ruta a tu componente PDF
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
  FileText, // Para el botón PDF y otros
  ClipboardList,
  DollarSign,
  Plus,
  Info, // Para la tarjeta de Info General
  TrendingUp, // Para Resumen Financiero (si se mostrara aquí)
  Wallet,     // Para Resumen Financiero (si se mostrara aquí)
} from 'lucide-react';
import { differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import CommissionTaskCommentPopup from '../../components/CommissionTaskCommentPopup';
import CommissionTaskCommentList from '../../components/CommissionTaskCommentList';
// Asumo que AtRiskPopup se importa si handleToggleAtRisk se usa completamente
// import AtRiskPopup from '../../components/AtRiskPopup'; 

// --- INICIO: Definiciones de Tipos (Consistentes con otros archivos) ---
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
// Interfaz para PaymentFlow (tuya, con campos de reserva necesarios para el resumen financiero)
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
      total_payment?: number; 
      subsidy_payment?: number; 
      minimum_price?: number; 
      client: { id: string; first_name: string; last_name: string; rut: string; };
      project: { name: string; stage: string; };
      apartment_number: string;
      broker: { id: string; name: string; business_name: string; };
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
// Interfaz para el resumen financiero que se pasará al PDF
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
  const [loadingPdfData, setLoadingPdfData] = useState(false); // Estado de carga para datos del PDF
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
      Promise.all([
        fetchFlow(), // Carga el flujo principal
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

  // --- useEffect para cargar datos dependientes (promociones, resumen) una vez que 'flow' esté disponible ---
  useEffect(() => {
    const loadDependentData = async () => {
      if (flow && flow.broker_commission?.reservation?.id) {
        const reservationId = flow.broker_commission.reservation.id;
        setLoadingPdfData(true); // Iniciar carga de datos para PDF
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
          setError(prev => prev ? `${prev}, ${err.message}`: `Error al cargar datos para PDF: ${err.message}`);
        } finally {
          setLoadingPdfData(false); // Finalizar carga de datos para PDF
        }
      }
    };

    if (flow) {
        loadDependentData();
    }
  }, [flow]); // Dependencia: 'flow'

  const checkAdminStatus = async () => { /* ... (código sin cambios) ... */ };
  const fetchUsers = async () => { /* ... (código sin cambios) ... */ };
  const fetchFlow = async () => { /* ... (código sin cambios, asegúrate que el SELECT en reservations incluye total_payment, subsidy_payment, minimum_price) ... */ };
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
  // formatDate y formatDateTime ya están importados y disponibles
  // formatCurrency también está importado desde lib/supabase
  const navigateToEditClient = () => { /* ... (código sin cambios) ... */ };
  const navigateToEditReservation = () => { /* ... (código sin cambios) ... */ };
  const navigateToEditCommission = () => { /* ... (código sin cambios) ... */ };
  const navigateToReservationFlow = async () => { /* ... (código sin cambios) ... */ };
  const navigateToDocuments = () => { /* ... (código sin cambios) ... */ };
  const navigateToTaskTracking = () => { /* ... (código sin cambios) ... */ };
  const handleCreateSecondPaymentFlow = async () => { /* ... (código sin cambios) ... */ };
  const handleDateInputChange = async (e: React.ChangeEvent<HTMLInputElement>, templateTaskId: string, type: 'start' | 'complete') => { /* ... (código sin cambios) ... */ };
  const handleToggleAtRisk = () => { /* ... (código sin cambios, asegúrate que AtRiskPopup se importe si es necesario) ... */ };

  if (loading) { return <Layout><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div></Layout>; }
  if (error) { return <Layout><div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">Error: {error}</div></Layout>; }
  if (!flow) { return <Layout><div className="p-4 text-center text-gray-500">No se encontró información para este flujo de pago.</div></Layout>; }

  const canCreateSecondPaymentFlow = flow.status === 'completed' && flow.broker_commission.number_of_payments === 2 && !flow.is_second_payment;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header y Navegación de Iconos */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/pagos')} className="flex items-center text-gray-600 hover:text-gray-900"><ArrowLeft className="h-5 w-5 mr-2" /> Volver</button>
          <h1 className="text-2xl font-semibold text-gray-900">{flow.is_second_payment ? 'Segundo Pago' : 'Flujo de Pago'} - Reserva {flow.broker_commission.reservation.reservation_number}</h1>
          <div className="flex space-x-1 md:space-x-2">
            <button onClick={navigateToEditClient} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Cliente"><Users className="h-5 w-5" /></button>
            <button onClick={navigateToEditReservation} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Reserva"><Edit2 className="h-5 w-5" /></button>
            <button onClick={navigateToEditCommission} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar Comisión"><DollarSign className="h-5 w-5" /></button>
            <button onClick={navigateToReservationFlow} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Flujo de Reserva"><ListChecks className="h-5 w-5" /></button>
            {/* El botón de Documentos se mueve a la nueva tarjeta de Informes */}
            {/* El botón de Seguimiento de Tareas se mueve a la nueva tarjeta de Informes */}
          </div>
        </div>
        
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div> {/* Información General */}
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>
                        {/* ... (contenido existente de Información General) ... */}
                    </div>
                    <div> {/* Estado del Proceso */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Estado del Proceso</h2>
                            {/* ... (Botones de acción del flujo) ... */}
                        </div>
                        {/* ... (contenido existente de Estado del Proceso) ... */}
                    </div>
                </div>
            </div>

            {/* --- NUEVA TARJETA: Informes y Documentos --- */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                        <FileText className="h-6 w-6 mr-2 text-gray-700" />
                        Informes y Documentos
                    </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Botón para PDF de Liquidación */}
                    {flow && !loadingPdfData && financialSummaryForPDF && appliedPromotions && (
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
                    {loadingPdfData && (
                         <button className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-500 opacity-75 cursor-not-allowed" disabled>
                            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando datos PDF...
                        </button>
                    )}

                    {/* Botón para Documentos del Cliente */}
                    <button
                        onClick={navigateToDocuments}
                        className="flex items-center justify-center w-full px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        title="Documentos del Cliente"
                    >
                        <Users className="h-5 w-5 mr-2" /> Documentos Cliente
                    </button>

                    {/* Botón para Seguimiento de Tareas */}
                    <button
                        onClick={navigateToTaskTracking}
                        className="flex items-center justify-center w-full px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        title="Seguimiento de Tareas"
                    >
                        <ClipboardList className="h-5 w-5 mr-2" /> Seguimiento Tareas
                    </button>
                    {/* Aquí podrías agregar más botones para otros informes en el futuro */}
                </div>
            </div>
            {/* --- FIN NUEVA TARJETA --- */}
            
            {/* Etapas y Tareas del Flujo (código existente) */}
            {flow.stages.map((stage, stageIndex) => (
                <div id={`stage-${stage.id}`} key={stage.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* ... (contenido de la tarjeta de etapa y tareas, sin cambios) ... */}
                </div>
            ))}
        </div> {/* Fin de space-y-6 para todas las tarjetas */}
      </div>
    </Layout>
  );
};

// El componente AtRiskPopup ya está definido en tu código y no necesita cambios aquí.
// Si no está en este archivo, deberías importarlo.
// const AtRiskPopup: React.FC<AtRiskPopupProps> = ({ ... }) => { ... };

// El componente SummaryCard (si lo usas) también.
// const SummaryCard: React.FC<SummaryCardProps> = ({ ... }) => { ... };


export default PaymentFlowPage;