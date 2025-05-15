import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabase';
import {
  Building2,
  Users,
  ClipboardCheck,
  TrendingUp,
  UserCircle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Clock,
  CheckCircle2,
  Building,
  Home,
  AlertCircle
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardStats {
  totalReservations: number;
  totalClients: number;
  totalProjects: number;
  totalBrokers: number;
  monthlyStats: {
    reservations: number;
    commissions: number;
    previousReservations: number;
    previousCommissions: number;
  };
  recentActivity: {
    reservations: RecentReservation[];
    payments: RecentPayment[];
  };
  projectStats: {
    name: string;
    total: number;
    available: number;
    reserved: number;
  }[];
  brokerStats: {
    name: string;
    reservations: number;
    commissions: number;
  }[];
  monthlyReservations: {
    month: string;
    count: number;
  }[];
  monthlyCommissions: {
    month: string;
    amount: number;
  }[];
}

interface RecentReservation {
  id: string;
  reservation_number: string;
  reservation_date: string;
  client_name: string;
  project_name: string;
  project_stage: string;
  apartment_number: string;
  seller_name: string | null;
  seller_avatar?: string;
  broker_name: string | null;
  total_price: number;
}

interface RecentPayment {
  id: string;
  commission_flow_id: string;
  reservation_number: string;
  broker_name: string;
  commission_amount: number;
  payment_date: string;
  status: string;
  current_stage: string;
  current_task: string;
  days_overdue: number;
  assignee: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  } | null;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalReservations: 0,
    totalClients: 0,
    totalProjects: 0,
    totalBrokers: 0,
    monthlyStats: {
      reservations: 0,
      commissions: 0,
      previousReservations: 0,
      previousCommissions: 0
    },
    recentActivity: {
      reservations: [],
      payments: []
    },
    projectStats: [],
    brokerStats: [],
    monthlyReservations: [],
    monthlyCommissions: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const currentDate = new Date();
      const startOfCurrentMonth = startOfMonth(currentDate);
      const endOfCurrentMonth = endOfMonth(currentDate);
      const startOfPreviousMonth = startOfMonth(subMonths(currentDate, 1));
      const endOfPreviousMonth = endOfMonth(subMonths(currentDate, 1));

      // Get total counts
      const [
        { data: reservationsData, count: reservationsCount },
        { data: clientsData, count: clientsCount },
        { data: projectsData, count: projectsCount },
        { data: brokersData, count: brokersCount }
      ] = await Promise.all([
        supabase.from('reservations').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('brokers').select('*', { count: 'exact', head: true })
      ]);

      // Get monthly stats
      const [
        { data: currentMonthReservationsData, count: currentMonthReservationsCount },
        { data: previousMonthReservationsData, count: previousMonthReservationsCount },
        { data: currentMonthCommissions },
        { data: previousMonthCommissions }
      ] = await Promise.all([
        supabase
          .from('reservations')
          .select('*', { count: 'exact', head: true })
          .gte('reservation_date', startOfCurrentMonth.toISOString())
          .lte('reservation_date', endOfCurrentMonth.toISOString()),
        supabase
          .from('reservations')
          .select('*', { count: 'exact', head: true })
          .gte('reservation_date', startOfPreviousMonth.toISOString())
          .lte('reservation_date', endOfPreviousMonth.toISOString()),
        supabase
          .from('broker_commissions')
          .select('commission_amount')
          .gte('created_at', startOfCurrentMonth.toISOString())
          .lte('created_at', endOfCurrentMonth.toISOString()),
        supabase
          .from('broker_commissions')
          .select('commission_amount')
          .gte('created_at', startOfPreviousMonth.toISOString())
          .lte('created_at', endOfPreviousMonth.toISOString())
      ]);

      // Calculate total commissions
      const currentMonthTotal = currentMonthCommissions?.reduce((sum, { commission_amount }) => sum + commission_amount, 0) || 0;
      const previousMonthTotal = previousMonthCommissions?.reduce((sum, { commission_amount }) => sum + commission_amount, 0) || 0;

      // Get monthly reservations for the last 6 months
      const monthlyReservations = await Promise.all(
        Array.from({ length: 6 }).map(async (_, index) => {
          const monthStart = startOfMonth(subMonths(currentDate, 5 - index));
          const monthEnd = endOfMonth(subMonths(currentDate, 5 - index));
          
          const { count } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .gte('reservation_date', monthStart.toISOString())
            .lte('reservation_date', monthEnd.toISOString());
          
          return {
            month: format(monthStart, 'MMM', { locale: es }),
            count: count || 0
          };
        })
      );

      // Get monthly commissions for the last 6 months
      const monthlyCommissions = await Promise.all(
        Array.from({ length: 6 }).map(async (_, index) => {
          const monthStart = startOfMonth(subMonths(currentDate, 5 - index));
          const monthEnd = endOfMonth(subMonths(currentDate, 5 - index));
          
          const { data } = await supabase
            .from('broker_commissions')
            .select('commission_amount')
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString());
          
          const amount = data?.reduce((sum, { commission_amount }) => sum + commission_amount, 0) || 0;
          
          return {
            month: format(monthStart, 'MMM', { locale: es }),
            amount
          };
        })
      );

      // Get recent reservations
      const { data: recentReservations } = await supabase
        .from('reservations')
        .select(`
          id,
          reservation_number,
          reservation_date,
          apartment_number,
          total_price,
          project:projects(name, stage),
          client:clients(first_name, last_name),
          seller:profiles(first_name, last_name, avatar_url),
          broker:brokers(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get recent payments (commission flows that have started)
      const { data: recentPaymentsData } = await supabase
        .from('commission_flows')
        .select(`
          id,
          status,
          started_at,
          current_stage:payment_flow_stages(name),
          broker_commission:broker_commissions(
            commission_amount,
            reservation:reservations(
              reservation_number
            ),
            broker:brokers(
              name
            )
          )
        `)
        .not('started_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(5);

      // Get current tasks for each payment flow
      const recentPayments = await Promise.all((recentPaymentsData || []).map(async (payment) => {
        // Get the current pending task for this flow
        const { data: currentTask } = await supabase
          .from('commission_flow_tasks')
          .select(`
            id,
            status,
            started_at,
            task:payment_flow_tasks(name, days_to_complete),
            assignee:profiles(id, first_name, last_name, avatar_url)
          `)
          .eq('commission_flow_id', payment.id)
          .in('status', ['pending', 'in_progress'])
          .order('started_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        // Calculate days overdue
        let daysOverdue = 0;
        if (currentTask?.started_at && currentTask?.task?.days_to_complete) {
          const startDate = new Date(currentTask.started_at);
          const daysElapsed = differenceInDays(new Date(), startDate);
          daysOverdue = Math.max(0, daysElapsed - currentTask.task.days_to_complete);
        }

        return {
          id: payment.id,
          commission_flow_id: payment.id,
          reservation_number: payment.broker_commission.reservation.reservation_number,
          broker_name: payment.broker_commission.broker.name,
          commission_amount: payment.broker_commission.commission_amount,
          payment_date: payment.started_at,
          status: payment.status,
          current_stage: payment.current_stage?.name || 'No iniciado',
          current_task: currentTask?.task?.name || 'Sin tarea pendiente',
          days_overdue: daysOverdue,
          assignee: currentTask?.assignee || null
        };
      }));

      // Get project stats
      const { data: projectStats } = await supabase
        .from('projects')
        .select(`
          name,
          total_units:id(count),
          reserved_units:reservations(count)
        `)
        .limit(5);

      // Get broker stats
      const { data: brokerStats } = await supabase
        .from('brokers')
        .select(`
          name,
          reservations:reservations(count),
          commissions:broker_commissions(commission_amount)
        `)
        .limit(5);

      // Format recent reservations
      const formattedReservations = recentReservations?.map(reservation => ({
        id: reservation.id,
        reservation_number: reservation.reservation_number,
        reservation_date: reservation.reservation_date,
        client_name: `${reservation.client.first_name} ${reservation.client.last_name}`,
        project_name: reservation.project.name,
        project_stage: reservation.project.stage,
        apartment_number: reservation.apartment_number,
        seller_name: reservation.seller ? `${reservation.seller.first_name} ${reservation.seller.last_name}` : null,
        seller_avatar: reservation.seller?.avatar_url,
        broker_name: reservation.broker?.name,
        total_price: reservation.total_price
      })) || [];

      // Format project stats
      const formattedProjectStats = projectStats?.map(project => ({
        name: project.name,
        total: project.total_units?.count || 0,
        reserved: project.reserved_units?.count || 0,
        available: (project.total_units?.count || 0) - (project.reserved_units?.count || 0)
      })) || [];

      // Format broker stats
      const formattedBrokerStats = brokerStats?.map(broker => ({
        name: broker.name,
        reservations: broker.reservations?.count || 0,
        commissions: broker.commissions?.reduce((sum, { commission_amount }) => sum + commission_amount, 0) || 0
      })) || [];

      setStats({
        totalReservations: reservationsCount || 0,
        totalClients: clientsCount || 0,
        totalProjects: projectsCount || 0,
        totalBrokers: brokersCount || 0,
        monthlyStats: {
          reservations: currentMonthReservationsCount || 0,
          commissions: currentMonthTotal,
          previousReservations: previousMonthReservationsCount || 0,
          previousCommissions: previousMonthTotal
        },
        recentActivity: {
          reservations: formattedReservations,
          payments: recentPayments
        },
        projectStats: formattedProjectStats,
        brokerStats: formattedBrokerStats,
        monthlyReservations: monthlyReservations,
        monthlyCommissions: monthlyCommissions
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { value: 100, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(Math.round(change)),
      isPositive: change >= 0
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'PPP', { locale: es });
  };

  // Find the maximum value for scaling the charts
  const maxReservationCount = Math.max(...stats.monthlyReservations.map(item => item.count), 1);
  const maxCommissionAmount = Math.max(...stats.monthlyCommissions.map(item => item.amount), 1);

  const handlePaymentClick = (paymentId: string) => {
    navigate(`/pagos/flujo/${paymentId}`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <Clock className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Totales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Reservas</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalReservations}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <ClipboardCheck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {calculateTrend(stats.monthlyStats.reservations, stats.monthlyStats.previousReservations).isPositive ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            <p className={`text-sm ${
              calculateTrend(stats.monthlyStats.reservations, stats.monthlyStats.previousReservations).isPositive
                ? 'text-green-600'
                : 'text-red-600'
            }`}>
              {calculateTrend(stats.monthlyStats.reservations, stats.monthlyStats.previousReservations).value}% vs mes anterior
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Clientes</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalClients}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Clientes activos en el sistema</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Proyectos</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalProjects}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Building className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Proyectos en comercialización</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Brokers</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalBrokers}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <Building2 className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Brokers registrados</p>
          </div>
        </div>
      </div>

      {/* Estadísticas Mensuales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Reservas del Mes</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Reservas</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.monthlyStats.reservations}</p>
              </div>
              <div className={`flex items-center ${
                calculateTrend(stats.monthlyStats.reservations, stats.monthlyStats.previousReservations).isPositive
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {calculateTrend(stats.monthlyStats.reservations, stats.monthlyStats.previousReservations).isPositive ? (
                  <ArrowUpRight className="h-5 w-5" />
                ) : (
                  <ArrowDownRight className="h-5 w-5" />
                )}
                <span className="ml-1 text-sm font-medium">
                  {calculateTrend(stats.monthlyStats.reservations, stats.monthlyStats.previousReservations).value}%
                </span>
              </div>
            </div>

            <div className="h-[200px] flex items-end justify-between space-x-2">
              {stats.monthlyReservations.map((month, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex items-end justify-center h-[160px]">
                    <div 
                      className="w-10 bg-blue-500 bg-opacity-70 rounded-t hover:bg-blue-600 transition-all duration-300 cursor-pointer"
                      style={{ height: `${(month.count / maxReservationCount) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-center mt-2 text-gray-500">
                    {month.month}
                  </div>
                  <div className="text-xs text-center font-medium text-gray-700">
                    {month.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Comisiones del Mes</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Comisiones</p>
                <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats.monthlyStats.commissions)} UF</p>
              </div>
              <div className={`flex items-center ${
                calculateTrend(stats.monthlyStats.commissions, stats.monthlyStats.previousCommissions).isPositive
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {calculateTrend(stats.monthlyStats.commissions, stats.monthlyStats.previousCommissions).isPositive ? (
                  <ArrowUpRight className="h-5 w-5" />
                ) : (
                  <ArrowDownRight className="h-5 w-5" />
                )}
                <span className="ml-1 text-sm font-medium">
                  {calculateTrend(stats.monthlyStats.commissions, stats.monthlyStats.previousCommissions).value}%
                </span>
              </div>
            </div>

            <div className="h-[200px] flex items-end justify-between space-x-2">
              {stats.monthlyCommissions.map((month, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex items-end justify-center h-[160px]">
                    <div 
                      className="w-10 bg-green-500 bg-opacity-70 rounded-t hover:bg-green-600 transition-all duration-300 cursor-pointer"
                      style={{ height: `${(month.amount / maxCommissionAmount) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-center mt-2 text-gray-500">
                    {month.month}
                  </div>
                  <div className="text-xs text-center font-medium text-gray-700">
                    {formatCurrency(month.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas de Proyectos y Brokers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Estado de Proyectos</h3>
          <div className="space-y-6">
            {stats.projectStats.map((project, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{project.name}</span>
                  <span className="text-sm text-gray-500">
                    {project.reserved} / {project.total} unidades
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(project.reserved / project.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Brokers</h3>
          <div className="space-y-6">
            {stats.brokerStats.map((broker, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{broker.name}</span>
                  <span className="text-sm text-gray-500">
                    {broker.reservations} reservas • {formatCurrency(broker.commissions)} UF
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${(broker.reservations / Math.max(...stats.brokerStats.map(b => b.reservations))) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actividad Reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas Reservas */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Últimas Reservas</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {stats.recentActivity.reservations.map((reservation) => (
              <div key={reservation.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {reservation.seller_avatar ? (
                      <img
                        src={reservation.seller_avatar}
                        alt={reservation.seller_name || ''}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <UserCircle className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      Reserva {reservation.reservation_number}
                    </p>
                    <p className="text-sm text-gray-500">
                      {reservation.project_name} {reservation.project_stage} • Depto. {reservation.apartment_number}
                    </p>
                    <p className="text-sm text-gray-500">
                      Cliente: {reservation.client_name}
                    </p>
                    <div className="mt-1 text-sm text-gray-500">
                      {reservation.seller_name && (
                        <span>Vendedor: {reservation.seller_name}</span>
                      )}
                      {reservation.broker_name && (
                        <span className="ml-2">• Broker: {reservation.broker_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(reservation.total_price)} UF
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(reservation.reservation_date)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimos Pagos */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Últimos Pagos</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {stats.recentActivity.payments.map((payment) => (
              <div 
                key={payment.id} 
                className="p-6 hover:bg-gray-50 cursor-pointer"
                onClick={() => handlePaymentClick(payment.commission_flow_id)}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Wallet className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      Pago a {payment.broker_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      Reserva {payment.reservation_number}
                    </p>
                    <div className="mt-1 flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        payment.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        payment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {payment.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                        ) : (
                          <Clock className="h-4 w-4 mr-1" />
                        )}
                        {payment.status === 'completed' ? 'Completado' : 
                         payment.status === 'in_progress' ? payment.current_task : 
                         'Pendiente'}
                      </span>
                      
                      {payment.days_overdue > 0 && (
                        <span className="ml-2 inline-flex items-center text-xs font-medium text-red-600">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          {payment.days_overdue} días de atraso
                        </span>
                      )}
                    </div>
                    
                    {payment.assignee && (
                      <div className="mt-1 flex items-center text-xs text-gray-500">
                        <span className="flex items-center">
                          {payment.assignee.avatar_url ? (
                            <img 
                              src={payment.assignee.avatar_url} 
                              alt={`${payment.assignee.first_name} ${payment.assignee.last_name}`}
                              className="h-4 w-4 rounded-full mr-1"
                            />
                          ) : (
                            <UserCircle className="h-4 w-4 text-gray-400 mr-1" />
                          )}
                          Responsable: {payment.assignee.first_name} {payment.assignee.last_name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.commission_amount)} UF
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(payment.payment_date)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;