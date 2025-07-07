import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, subMonths, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface TVStats {
  todayReservations: number;
  monthReservations: number;
  previousMonthReservations: number;
  pendingPromises: number;
  recentPayments: number;
  totalRevenue: number;
  recentReservations: RecentReservation[];
  pendingFlows: PendingFlow[];
  recentPaymentsList: RecentPayment[];
}

interface RecentReservation {
  id: string;
  reservation_number: string;
  reservation_date: string;
  client_name: string;
  project_name: string;
  apartment_number: string;
  total_price: number;
  broker_name?: string;
}

interface PendingFlow {
  id: string;
  reservation_number: string;
  broker_name: string;
  current_stage: string;
  days_overdue: number;
  commission_amount: number;
}

interface RecentPayment {
  id: string;
  reservation_number: string;
  broker_name: string;
  commission_amount: number;
  payment_date: string;
  status: string;
}

const DashboardTV: React.FC = () => {
  const [stats, setStats] = useState<TVStats>({
    todayReservations: 0,
    monthReservations: 0,
    previousMonthReservations: 0,
    pendingPromises: 0,
    recentPayments: 0,
    totalRevenue: 0,
    recentReservations: [],
    pendingFlows: [],
    recentPaymentsList: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [newReservations, setNewReservations] = useState<string[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const previousStatsRef = useRef<TVStats>();

  // Función para formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Función para formatear fecha
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
  };

  // Función para calcular el porcentaje de cambio
  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Función para obtener datos del dashboard
  const fetchTVStats = async () => {
    try {
      const today = new Date();
      const startOfCurrentMonth = startOfMonth(today);
      const startOfPreviousMonth = startOfMonth(subMonths(today, 1));
      const endOfCurrentMonth = endOfMonth(today);
      const endOfPreviousMonth = endOfMonth(subMonths(today, 1));

      // Formato de fecha para consultas
      const todayStr = format(today, 'yyyy-MM-dd');
      const startCurrentMonthStr = format(startOfCurrentMonth, 'yyyy-MM-dd');
      const endCurrentMonthStr = format(endOfCurrentMonth, 'yyyy-MM-dd');
      const startPreviousMonthStr = format(startOfPreviousMonth, 'yyyy-MM-dd');
      const endPreviousMonthStr = format(endOfPreviousMonth, 'yyyy-MM-dd');

      // Obtener estadísticas principales
      const [
        { count: todayReservations },
        { count: monthReservations },
        { count: previousMonthReservations },
        { count: pendingPromises },
        { count: recentPayments }
      ] = await Promise.all([
        // Reservas de hoy
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('reservation_date', todayStr),
        
        // Reservas del mes actual
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .gte('reservation_date', startCurrentMonthStr)
          .lte('reservation_date', endCurrentMonthStr),
        
        // Reservas del mes anterior
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .gte('reservation_date', startPreviousMonthStr)
          .lte('reservation_date', endPreviousMonthStr),
        
        // Promesas pendientes (flujos en progreso)
        supabase
          .from('commission_flows')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'in_progress'),
        
        // Pagos recientes (últimos 7 días)
        supabase
          .from('commission_flows')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('completed_at', format(subMonths(today, 1), 'yyyy-MM-dd'))
      ]);

      // Obtener reservas recientes
      const { data: recentReservationsData } = await supabase
        .from('reservations')
        .select(`
          id,
          reservation_number,
          reservation_date,
          apartment_number,
          total_price,
          project:projects(name),
          client:clients(first_name, last_name),
          broker:brokers(name)
        `)
        .order('reservation_date', { ascending: false })
        .limit(5);

      // Obtener flujos pendientes
      const { data: pendingFlowsData } = await supabase
        .from('commission_flows')
        .select(`
          id,
          status,
          started_at,
          current_stage:payment_flow_stages(name),
          broker_commission:broker_commissions(
            commission_amount,
            reservation:reservations(reservation_number),
            broker:brokers(name)
          )
        `)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: true })
        .limit(5);

      // Obtener pagos recientes
      const { data: recentPaymentsData } = await supabase
        .from('commission_flows')
        .select(`
          id,
          completed_at,
          broker_commission:broker_commissions(
            commission_amount,
            reservation:reservations(reservation_number),
            broker:brokers(name)
          )
        `)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5);

      // Calcular ingresos totales del mes
      const { data: revenueData } = await supabase
        .from('reservations')
        .select('total_price')
        .gte('reservation_date', startCurrentMonthStr)
        .lte('reservation_date', endCurrentMonthStr);

      const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;

      // Formatear datos
      const formattedRecentReservations = (recentReservationsData || []).map((reservation: any) => ({
        id: reservation.id,
        reservation_number: reservation.reservation_number,
        reservation_date: reservation.reservation_date,
        client_name: reservation.client ? 
          `${reservation.client.first_name || ''} ${reservation.client.last_name || ''}`.trim() : '',
        project_name: reservation.project?.name || '',
        apartment_number: reservation.apartment_number,
        total_price: reservation.total_price,
        broker_name: reservation.broker?.name || ''
      }));

      const formattedPendingFlows = (pendingFlowsData || []).map((flow: any) => {
        const brokerCommission = Array.isArray(flow.broker_commission) ? 
          flow.broker_commission[0] : flow.broker_commission;
        
        const daysOverdue = flow.started_at ? 
          Math.floor((new Date().getTime() - new Date(flow.started_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;

        return {
          id: flow.id,
          reservation_number: brokerCommission?.reservation?.reservation_number || '',
          broker_name: brokerCommission?.broker?.name || '',
          current_stage: flow.current_stage?.name || '',
          days_overdue: daysOverdue,
          commission_amount: brokerCommission?.commission_amount || 0
        };
      });

      const formattedRecentPayments = (recentPaymentsData || []).map((payment: any) => {
        const brokerCommission = Array.isArray(payment.broker_commission) ? 
          payment.broker_commission[0] : payment.broker_commission;

        return {
          id: payment.id,
          reservation_number: brokerCommission?.reservation?.reservation_number || '',
          broker_name: brokerCommission?.broker?.name || '',
          commission_amount: brokerCommission?.commission_amount || 0,
          payment_date: payment.completed_at,
          status: 'completed'
        };
      });

      const newStats: TVStats = {
        todayReservations: todayReservations || 0,
        monthReservations: monthReservations || 0,
        previousMonthReservations: previousMonthReservations || 0,
        pendingPromises: pendingPromises || 0,
        recentPayments: recentPayments || 0,
        totalRevenue,
        recentReservations: formattedRecentReservations,
        pendingFlows: formattedPendingFlows,
        recentPaymentsList: formattedRecentPayments
      };

      // Verificar nuevas reservas
      if (previousStatsRef.current) {
        const newReservationIds = newStats.recentReservations
          .filter(r => !previousStatsRef.current!.recentReservations.some(pr => pr.id === r.id))
          .map(r => r.reservation_number);

        if (newReservationIds.length > 0) {
          setNewReservations(newReservationIds);
          setNotificationMessage(`¡Nueva reserva: ${newReservationIds[0]}!`);
          setShowNotification(true);
          setTimeout(() => setShowNotification(false), 5000);
        }
      }

      setStats(newStats);
      previousStatsRef.current = newStats;
      setLastUpdate(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Configurar actualización automática
  useEffect(() => {
    fetchTVStats();
    
    // Actualizar cada 30 segundos
    intervalRef.current = setInterval(fetchTVStats, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);



  if (loading) {
    return (
      <div className="dashboard-tv min-h-screen p-8">
        <div className="flex justify-center items-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
            <div className="text-2xl">Cargando Dashboard TV...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-tv min-h-screen p-8">
        <div className="text-center text-red-400 text-xl">
          Error: {error}
        </div>
      </div>
    );
  }

  const monthChange = calculatePercentageChange(stats.monthReservations, stats.previousMonthReservations);

  return (
    <div className="dashboard-tv min-h-screen p-8">
      {/* Notificación de nueva reserva */}
      {showNotification && (
        <div className="tv-notification">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6" />
            <span className="font-semibold">{notificationMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="tv-title">Dashboard Comercial</h1>
        <p className="tv-subtitle">InverApp - Información en Tiempo Real</p>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {/* Reservas del Mes */}
        <div className="tv-card">
          <div className="text-lg font-semibold mb-4 text-blue-200">Reservas del Mes</div>
          <div className="tv-metric">{stats.monthReservations}</div>
          <div className={`text-sm flex items-center gap-1 ${monthChange > 0 ? 'text-green-400' : monthChange < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
            {monthChange > 0 ? <ArrowUp className="h-4 w-4" /> : monthChange < 0 ? <ArrowDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            {monthChange > 0 ? '+' : ''}{monthChange.toFixed(0)}% vs mes anterior
          </div>
        </div>

        {/* Reservas de Hoy */}
        <div className="tv-card">
          <div className="text-lg font-semibold mb-4 text-blue-200">Reservas de Hoy</div>
          <div className="tv-metric">{stats.todayReservations}</div>
          <div className="text-sm text-blue-200">Actualizado en tiempo real</div>
        </div>

        {/* Promesas Pendientes */}
        <div className="tv-card">
          <div className="text-lg font-semibold mb-4 text-blue-200">Promesas Pendientes</div>
          <div className="tv-metric">{stats.pendingPromises}</div>
          <div className="text-sm text-blue-200">Flujos en progreso</div>
        </div>

        {/* Ingresos del Mes */}
        <div className="tv-card">
          <div className="text-lg font-semibold mb-4 text-blue-200">Ingresos del Mes</div>
          <div className="tv-metric">{formatCurrency(stats.totalRevenue)} UF</div>
          <div className="text-sm text-blue-200">Total acumulado</div>
        </div>
      </div>

      {/* Información detallada */}
      <div className="grid grid-cols-3 gap-6">
        {/* Últimas Reservas */}
        <div className="tv-card">
          <div className="text-lg font-semibold mb-4 text-blue-200">Últimas Reservas</div>
          <div className="space-y-3">
            {stats.recentReservations.map((reservation) => (
              <div key={reservation.id} className="tv-list-item">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-white">Reserva {reservation.reservation_number}</div>
                    <div className="text-sm text-blue-200">{reservation.project_name}</div>
                    <div className="text-sm text-blue-200">Cliente: {reservation.client_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">{formatCurrency(reservation.total_price)} UF</div>
                    <div className="text-sm text-blue-200">{formatDate(reservation.reservation_date)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Promesas Pendientes */}
        <div className="tv-card">
          <div className="text-lg font-semibold mb-4 text-blue-200">Promesas Pendientes</div>
          <div className="space-y-3">
            {stats.pendingFlows.map((flow) => (
              <div key={flow.id} className="tv-list-item">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-white">Reserva {flow.reservation_number}</div>
                    <div className="text-sm text-blue-200">Broker: {flow.broker_name}</div>
                    <div className="text-sm text-blue-200">Etapa: {flow.current_stage}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">{formatCurrency(flow.commission_amount)} UF</div>
                    {flow.days_overdue > 0 && (
                      <div className="text-sm text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {flow.days_overdue} días
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagos Recientes */}
        <div className="tv-card">
          <div className="text-lg font-semibold mb-4 text-blue-200">Pagos Recientes</div>
          <div className="space-y-3">
            {stats.recentPaymentsList.map((payment) => (
              <div key={payment.id} className="tv-list-item">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-white">Reserva {payment.reservation_number}</div>
                    <div className="text-sm text-blue-200">Broker: {payment.broker_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">{formatCurrency(payment.commission_amount)} UF</div>
                    <div className="text-sm text-blue-200">{formatDate(payment.payment_date)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Última actualización */}
      <div className="tv-update-info">
        Última actualización: {format(lastUpdate, 'dd/MM/yyyy HH:mm:ss', { locale: es })} | 
        Actualización automática cada 30 segundos
      </div>
    </div>
  );
};

export default DashboardTV; 