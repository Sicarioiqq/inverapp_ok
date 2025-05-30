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
    recent_reservations: number;
  }[];
  brokerStats: {
    name: string;
    reservations: number;
    commissions: number;
  }[];
  monthlyReservations: {
    month: string;
    count: number;
    total_price: number;
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

interface Task {
  name: string;
  days_to_complete: number;
}

interface BrokerCommission {
  commission_amount: number;
  reservation: {
    reservation_number: string;
  };
  broker: {
    name: string;
  };
}

interface PaymentFlowStage {
  name: string;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface Project {
  name: string;
  stage: string;
}

interface Client {
  first_name: string;
  last_name: string;
}

interface Broker {
  name: string;
}

interface CountResult {
  count: number;
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
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

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
          
          const { count, data } = await supabase
            .from('reservations')
            .select('total_price', { count: 'exact' })
            .gte('reservation_date', monthStart.toISOString())
            .lte('reservation_date', monthEnd.toISOString());
          
          const total_price = data?.reduce((sum, { total_price }) => sum + (total_price || 0), 0) || 0;
          
          return {
            month: format(monthStart, 'MMMM', { locale: es }),
            count: count || 0,
            total_price
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
            month: format(monthStart, 'MMMM', { locale: es }),
            amount
          };
        })
      );

      // Obtener las 5 reservas más recientes con toda la información relevante
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
        .order('reservation_date', { ascending: false })
        .limit(5);

      // Formatear las reservas recientes para el renderizado
      const formattedReservations = (recentReservations || []).map(reservation => ({
        id: reservation.id,
        reservation_number: reservation.reservation_number,
        reservation_date: reservation.reservation_date,
        apartment_number: reservation.apartment_number,
        total_price: reservation.total_price,
        project_name: reservation.project?.name || '',
        project_stage: reservation.project?.stage || '',
        client_name: reservation.client ? `${reservation.client.first_name} ${reservation.client.last_name}` : '',
        seller_name: reservation.seller ? `${reservation.seller.first_name} ${reservation.seller.last_name}` : '',
        seller_avatar: reservation.seller?.avatar_url || '',
        broker_name: reservation.broker?.name || ''
      }));

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

        const brokerCommission = payment.broker_commission as BrokerCommission;
        const currentStage = payment.current_stage as PaymentFlowStage;
        const task = currentTask?.task as Task;
        const assignee = currentTask?.assignee as Profile;

        return {
          id: payment.id,
          commission_flow_id: payment.id,
          reservation_number: brokerCommission.reservation.reservation_number,
          broker_name: brokerCommission.broker.name,
          commission_amount: brokerCommission.commission_amount,
          payment_date: payment.started_at,
          status: payment.status,
          current_stage: currentStage?.name || 'No iniciado',
          current_task: task?.name || 'Sin tarea pendiente',
          days_overdue: daysOverdue,
          assignee: assignee || null
        };
      }));

      // 1. Obtener todas las reservas históricas para contar el total por proyecto
      const { data: allReservations } = await supabase
        .from('reservations')
        .select('project:projects(name)');

      // 2. Obtener reservas de los últimos 3 meses con total_price
      const threeMonthsAgo = subMonths(currentDate, 3);
      const { data: projectStats } = await supabase
        .from('reservations')
        .select(`
          project:projects(name),
          total_price
        `)
        .gte('reservation_date', threeMonthsAgo.toISOString());

      // 3. Agrupar y calcular datos por proyecto
      const projectMap: { [key: string]: { name: string; recent_reservations: number; recent_total_price: number; total_reservations: number; } } = {};

      // Contar reservas históricas
      (allReservations || []).forEach(r => {
        const name = r.project?.name;
        if (!name) return;
        if (!projectMap[name]) {
          projectMap[name] = { name, recent_reservations: 0, recent_total_price: 0, total_reservations: 0 };
        }
        projectMap[name].total_reservations += 1;
      });

      // Contar reservas y suma de UF de los últimos 3 meses
      (projectStats || []).forEach(r => {
        const name = r.project?.name;
        if (!name) return;
        if (!projectMap[name]) {
          projectMap[name] = { name, recent_reservations: 0, recent_total_price: 0, total_reservations: 0 };
        }
        projectMap[name].recent_reservations += 1;
        projectMap[name].recent_total_price += r.total_price || 0;
      });

      // Calcular totales para % de participación
      const totalRecentReservations = Object.values(projectMap).reduce((sum, p) => sum + p.recent_reservations, 0);

      // Convertir a array, ordenar y tomar top 5
      const formattedProjectStats = Object.values(projectMap)
        .filter(p => p.recent_reservations > 0)
        .sort((a, b) => b.recent_reservations - a.recent_reservations)
        .slice(0, 5)
        .map(project => ({
          name: project.name,
          recent_reservations: project.recent_reservations,
          recent_total_price: project.recent_total_price,
          total_reservations: project.total_reservations,
          participation: totalRecentReservations > 0 ? (project.recent_reservations / totalRecentReservations) * 100 : 0
        }));

      // 1. Obtener todas las reservas históricas para contar el total por broker
      const { data: allBrokerReservations } = await supabase
        .from('reservations')
        .select('broker:brokers(name)');

      // 2. Obtener reservas de los últimos 3 meses con total_price y broker
      const { data: brokerStats } = await supabase
        .from('reservations')
        .select(`
          broker:brokers(name),
          total_price
        `)
        .gte('reservation_date', threeMonthsAgo.toISOString());

      // 3. Agrupar y calcular datos por broker
      const brokerMap: { [key: string]: { name: string; recent_reservations: number; recent_total_price: number; total_reservations: number; } } = {};

      // Contar reservas históricas
      (allBrokerReservations || []).forEach(r => {
        const name = r.broker?.name;
        if (!name) return;
        if (!brokerMap[name]) {
          brokerMap[name] = { name, recent_reservations: 0, recent_total_price: 0, total_reservations: 0 };
        }
        brokerMap[name].total_reservations += 1;
      });

      // Contar reservas y suma de UF de los últimos 3 meses
      (brokerStats || []).forEach(r => {
        const name = r.broker?.name;
        if (!name) return;
        if (!brokerMap[name]) {
          brokerMap[name] = { name, recent_reservations: 0, recent_total_price: 0, total_reservations: 0 };
        }
        brokerMap[name].recent_reservations += 1;
        brokerMap[name].recent_total_price += r.total_price || 0;
      });

      // Calcular totales para % de participación
      const totalRecentBrokerReservations = Object.values(brokerMap).reduce((sum, b) => sum + b.recent_reservations, 0);

      // Convertir a array, ordenar y tomar top 5
      const formattedBrokerStats = Object.values(brokerMap)
        .filter(b => b.recent_reservations > 0)
        .sort((a, b) => b.recent_reservations - a.recent_reservations)
        .slice(0, 5)
        .map(broker => ({
          name: broker.name,
          recent_reservations: broker.recent_reservations,
          recent_total_price: broker.recent_total_price,
          total_reservations: broker.total_reservations,
          participation: totalRecentBrokerReservations > 0 ? (broker.recent_reservations / totalRecentBrokerReservations) * 100 : 0
        }));

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

  const handleMonthClick = (month: string) => {
    setSelectedMonth(month === selectedMonth ? null : month);
  };

  const handleReservationClick = async (reservationId: string) => {
    try {
      // Obtener el ID del flujo de reserva
      const { data, error } = await supabase
        .from('reservation_flows')
        .select('id')
        .eq('reservation_id', reservationId)
        .single();

      if (error) throw error;

      if (data) {
        navigate(`/flujo-reservas/${data.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    }
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
                <div key={index} className="flex-1 flex flex-col items-center relative group">
                  <div className="w-full flex items-end justify-center h-[160px]">
                    <div 
                      className={`w-10 bg-blue-500 bg-opacity-70 rounded-t hover:bg-blue-600 transition-all duration-300 cursor-pointer ${
                        selectedMonth === month.month ? 'bg-blue-700' : ''
                      }`}
                      style={{ height: `${(month.count / maxReservationCount) * 100}%` }}
                      onClick={() => handleMonthClick(month.month)}
                    ></div>
                  </div>
                  <div className="text-xs text-center mt-2 text-gray-500">
                    {month.month}
                  </div>
                  <div className="text-xs text-center font-medium text-gray-700">
                    {month.count}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                    Total: {formatCurrency(month.total_price)} UF
                  </div>
                </div>
              ))}
            </div>
            {/* Detalle del mes seleccionado */}
            {selectedMonth && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Detalle de {selectedMonth}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Total Reservas</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {stats.monthlyReservations.find(m => m.month === selectedMonth)?.count || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Ventas</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(stats.monthlyReservations.find(m => m.month === selectedMonth)?.total_price || 0)} UF
                    </p>
                  </div>
                </div>
              </div>
            )}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top 5 Proyectos (Últimos 3 meses)</h3>
          <div className="space-y-6">
            {stats.projectStats.map((project, index) => {
              const maxReservations = Math.max(...stats.projectStats.map(p => p.recent_reservations));
              const barWidth = (project.recent_reservations / maxReservations) * 100;
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{project.name}</span>
                    <span className="text-sm text-blue-600 font-medium">
                      {project.recent_reservations} reservas
                    </span>
                  </div>
                  <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-500 ease-out"
                      style={{ width: `${barWidth}%` }}
                    >
                      <div className="absolute inset-0 flex items-center px-3">
                        <span className="text-xs text-white font-medium">
                          {project.participation.toFixed(1)}% de participación
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{project.total_reservations} ventas históricas</span>
                    <span>{project.recent_total_price.toLocaleString('es-CL', { minimumFractionDigits: 2 })} UF (últ. 3 meses)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top 5 Brokers (Últimos 3 meses)</h3>
          <div className="space-y-6">
            {stats.brokerStats.map((broker, index) => {
              const maxReservations = Math.max(...stats.brokerStats.map(b => b.recent_reservations));
              const barWidth = (broker.recent_reservations / maxReservations) * 100;
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{broker.name}</span>
                    <span className="text-sm text-blue-600 font-medium">
                      {broker.recent_reservations} reservas
                    </span>
                  </div>
                  <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-500 ease-out"
                      style={{ width: `${barWidth}%` }}
                    >
                      <div className="absolute inset-0 flex items-center px-3">
                        <span className="text-xs text-white font-medium">
                          {broker.participation.toFixed(1)}% de participación
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{broker.total_reservations} ventas históricas</span>
                    <span>{broker.recent_total_price.toLocaleString('es-CL', { minimumFractionDigits: 2 })} UF (últ. 3 meses)</span>
                  </div>
                </div>
              );
            })}
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
              <div 
                key={reservation.id} 
                className="p-6 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleReservationClick(reservation.id)}
              >
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