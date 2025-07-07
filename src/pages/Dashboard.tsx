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
  AlertCircle,
  FileText
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tab } from '@headlessui/react';
import DashboardCard from '../components/DashboardCard';
import DashboardChart from '../components/DashboardChart';

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
    total_uf: number;
  }[];
  monthlyCommissions: {
    month: string;
    amount: number;
  }[];
  quotationStats: {
    totalQuotations: number;
    todayQuotations: number;
    weekQuotations: number;
    monthQuotations: number;
  };
  recentQuotations: RecentQuotation[];
  brokerQuotationStats: BrokerQuotationStat[];
  projectQuotationStats: ProjectQuotationStat[];
  monthlyQuotations: {
    month: string;
    count: number;
    total_uf: number;
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

interface RecentQuotation {
  id: number;
  broker_id: string;
  broker_name: string;
  client_name: string;
  project_name: string;
  unit_number: string;
  quotation_type: string;
  total_deed_price: number;
  created_at: string;
}

interface BrokerQuotationStat {
  broker_name: string;
  total_quotations: number;
  today_quotations: number;
  week_quotations: number;
  month_quotations: number;
}

interface ProjectQuotationStat {
  project_name: string;
  total_quotations: number;
  today_quotations: number;
  week_quotations: number;
  month_quotations: number;
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
    monthlyCommissions: [],
    quotationStats: {
      totalQuotations: 0,
      todayQuotations: 0,
      weekQuotations: 0,
      monthQuotations: 0
    },
    recentQuotations: [],
    brokerQuotationStats: [],
    projectQuotationStats: [],
    monthlyQuotations: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState('reservas');
  const [chartMode, setChartMode] = useState<'unidades' | 'uf'>('unidades');

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
        { data: brokersData, count: brokersCount },
        { data: quotesData, count: quotesCount }
      ] = await Promise.all([
        supabase.from('reservations').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('brokers').select('*', { count: 'exact', head: true }),
        supabase.from('quotes').select('*', { count: 'exact', head: true })
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
          const monthStartDate = startOfMonth(subMonths(currentDate, 5 - index));
          const monthEndDate = endOfMonth(subMonths(currentDate, 5 - index));
          // Formato local YYYY-MM-DD
          const monthStart = `${monthStartDate.getFullYear()}-${String(monthStartDate.getMonth() + 1).padStart(2, '0')}-${String(monthStartDate.getDate()).padStart(2, '0')}`;
          const monthEnd = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

          // Traer reservas del mes con los campos necesarios
          const { data: reservations, count } = await supabase
            .from('reservations')
            .select('id, minimum_price, total_payment, subsidy_payment')
            .gte('reservation_date', monthStart)
            .lte('reservation_date', monthEnd);

          if (!reservations || reservations.length === 0) {
            return {
              month: format(monthStartDate, 'MMMM', { locale: es }),
              count: 0,
              total_uf: 0
            };
          }

          // Para cada reserva, obtener comisión y promociones contra descuento
          let totalUF = 0;
          for (const reservation of reservations) {
            // Obtener comisión asociada
            const { data: brokerCommission } = await supabase
              .from('broker_commissions')
              .select('commission_amount')
              .eq('reservation_id', reservation.id)
              .maybeSingle();
            const commission_amount = brokerCommission?.commission_amount || 0;

            // Obtener promociones contra descuento
            const { data: promos } = await supabase
              .from('promotions')
              .select('amount, is_against_discount')
              .eq('reservation_id', reservation.id);
            const totalPromotionsAgainstDiscountVal = (promos || []).reduce((sum, p) => p.is_against_discount ? sum + (p.amount || 0) : sum, 0);

            // Calcular valores
            const minimum_price = reservation.minimum_price || 0;
            const total_payment = reservation.total_payment || 0;
            const subsidy_payment = reservation.subsidy_payment || 0;
            const recoveryPaymentVal = total_payment - subsidy_payment;
            const differenceVal = recoveryPaymentVal - minimum_price - commission_amount - totalPromotionsAgainstDiscountVal;
            const ufValue = minimum_price + differenceVal;
            totalUF += ufValue;
          }

          return {
            month: format(monthStartDate, 'MMMM', { locale: es }),
            count: count || reservations.length,
            total_uf: totalUF
          };
        })
      );

      // Get monthly net commissions for the last 6 months
      const monthlyCommissions = await Promise.all(
        Array.from({ length: 6 }).map(async (_, index) => {
          const monthStartDate = startOfMonth(subMonths(currentDate, 5 - index));
          const monthEndDate = endOfMonth(subMonths(currentDate, 5 - index));
          // Formato local YYYY-MM-DD
          const monthStart = `${monthStartDate.getFullYear()}-${String(monthStartDate.getMonth() + 1).padStart(2, '0')}-${String(monthStartDate.getDate()).padStart(2, '0')}`;
          const monthEnd = `${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth() + 1).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;
          // 1. Traer reservas del mes de pago de comisión
          const { data: reservations } = await supabase
            .from('reservations')
            .select('id, total_payment, subsidy_payment, commission_payment_month')
            .not('commission_payment_month', 'is', null)
            .gte('commission_payment_month', monthStart)
            .lte('commission_payment_month', monthEnd);

          if (!reservations || reservations.length === 0) {
            return {
              month: format(monthStartDate, 'MMMM', { locale: es }),
              amount: 0
            };
          }

          // 2. Para cada reserva, traer promociones contra descuento y calcular neto
          let totalNet = 0;
          for (const reservation of reservations) {
            const { data: promos } = await supabase
              .from('promotions')
              .select('amount')
              .eq('reservation_id', reservation.id)
              .eq('is_against_discount', true);
            const promosSum = (promos || []).reduce((sum, p) => sum + (p.amount || 0), 0);
            const net = (reservation.total_payment || 0) - (reservation.subsidy_payment || 0) - promosSum;
            totalNet += net;
          }

          return {
            month: format(monthStartDate, 'MMMM', { locale: es }),
            amount: totalNet
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

      // Obtener estadísticas de cotizaciones
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
      const startOfCurrentMonthForQuotes = startOfMonth(currentDate);

      // Obtener cotizaciones por período
      const [
        { count: todayQuotesCount },
        { count: weekQuotesCount },
        { count: monthQuotesCount }
      ] = await Promise.all([
        supabase
          .from('quotes')
          .select('id', { count: 'exact', head: true })
          .gte('fecha', startOfToday.toISOString()),
        supabase
          .from('quotes')
          .select('id', { count: 'exact', head: true })
          .gte('fecha', startOfWeek.toISOString()),
        supabase
          .from('quotes')
          .select('id', { count: 'exact', head: true })
          .gte('fecha', startOfCurrentMonthForQuotes.toISOString())
      ]);

      // Obtener cotizaciones recientes
      const { data: recentQuotesData } = await supabase
        .from('quotes')
        .select('id, fecha, broker_nombre, proyecto, unidad, tipologia, monto_total, total_escritura')
        .order('fecha', { ascending: false })
        .limit(5);

      // Formatear cotizaciones recientes
      const formattedRecentQuotations = (recentQuotesData || []).map(quote => ({
        id: quote.id,
        broker_name: quote.broker_nombre,
        project_name: quote.proyecto,
        unit_number: quote.unidad,
        tipologia: quote.tipologia,
        total_deed_price: quote.total_escritura || quote.monto_total || 0,
        created_at: quote.fecha
      }));

      // Obtener estadísticas de cotizaciones por broker
      const { data: brokerQuotesData } = await supabase
        .from('quotes')
        .select('broker_nombre, fecha');

      // Agrupar cotizaciones por broker
      const brokerQuotationMap: { [key: string]: BrokerQuotationStat } = {};
      (brokerQuotesData || []).forEach(quote => {
        const brokerName = quote.broker_nombre || 'Sin broker';
        if (!brokerQuotationMap[brokerName]) {
          brokerQuotationMap[brokerName] = {
            broker_name: brokerName,
            total_quotations: 0,
            today_quotations: 0,
            week_quotations: 0,
            month_quotations: 0
          };
        }
        const createdAt = new Date(quote.fecha);
        brokerQuotationMap[brokerName].total_quotations += 1;
        if (createdAt >= startOfToday) brokerQuotationMap[brokerName].today_quotations += 1;
        if (createdAt >= startOfWeek) brokerQuotationMap[brokerName].week_quotations += 1;
        if (createdAt >= startOfCurrentMonthForQuotes) brokerQuotationMap[brokerName].month_quotations += 1;
      });

      const formattedBrokerQuotationStats = Object.values(brokerQuotationMap)
        .sort((a, b) => b.total_quotations - a.total_quotations)
        .slice(0, 5);

      // Obtener estadísticas de cotizaciones por proyecto
      const { data: projectQuotesData } = await supabase
        .from('quotes')
        .select('proyecto, fecha');

      // Agrupar cotizaciones por proyecto
      const projectQuotationMap: { [key: string]: ProjectQuotationStat } = {};
      (projectQuotesData || []).forEach(quote => {
        const projectName = quote.proyecto || 'Sin proyecto';
        if (!projectQuotationMap[projectName]) {
          projectQuotationMap[projectName] = {
            project_name: projectName,
            total_quotations: 0,
            today_quotations: 0,
            week_quotations: 0,
            month_quotations: 0
          };
        }
        const createdAt = new Date(quote.fecha);
        projectQuotationMap[projectName].total_quotations += 1;
        if (createdAt >= startOfToday) projectQuotationMap[projectName].today_quotations += 1;
        if (createdAt >= startOfWeek) projectQuotationMap[projectName].week_quotations += 1;
        if (createdAt >= startOfCurrentMonthForQuotes) projectQuotationMap[projectName].month_quotations += 1;
      });

      const formattedProjectQuotationStats = Object.values(projectQuotationMap)
        .sort((a, b) => b.total_quotations - a.total_quotations)
        .slice(0, 5);

      // Obtener cotizaciones mensuales para el gráfico
      const monthlyQuotations = await Promise.all(
        Array.from({ length: 6 }).map(async (_, index) => {
          const monthStartDate = startOfMonth(subMonths(currentDate, 5 - index));
          const monthEndDate = endOfMonth(subMonths(currentDate, 5 - index));
          const { data: quotes, count } = await supabase
            .from('quotes')
            .select('total_escritura, monto_total, fecha', { count: 'exact', head: false })
            .gte('fecha', monthStartDate.toISOString())
            .lte('fecha', monthEndDate.toISOString());
          const totalUF = (quotes || []).reduce((sum, q) => sum + (q.total_escritura || q.monto_total || 0), 0);
          return {
            month: format(monthStartDate, 'MMMM', { locale: es }),
            count: count || 0,
            total_uf: totalUF
          };
        })
      );

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
        monthlyCommissions: monthlyCommissions,
        quotationStats: {
          totalQuotations: quotesCount || 0,
          todayQuotations: todayQuotesCount || 0,
          weekQuotations: weekQuotesCount || 0,
          monthQuotations: monthQuotesCount || 0
        },
        recentQuotations: formattedRecentQuotations,
        brokerQuotationStats: formattedBrokerQuotationStats,
        projectQuotationStats: formattedProjectQuotationStats,
        monthlyQuotations: monthlyQuotations
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

  // Datos para el gráfico según el modo
  const barsData = chartMode === 'unidades'
    ? stats.monthlyReservations.map(m => ({ value: m.count, label: m.month }))
    : stats.monthlyReservations.map(m => ({ value: m.total_uf, label: m.month }));

  // Contenido de cada informe
  const renderReportContent = () => {
    switch (activeReport) {
      case 'reservas':
        return (
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
        );
      case 'comisiones':
        return (
          <div className="p-6 text-gray-700">
            {/* Aquí puedes poner un gráfico o tabla de comisiones */}
            <h3 className="text-lg font-semibold mb-4">Comisiones del mes</h3>
            <ul>
              {stats.monthlyCommissions.slice(-1).map((item, idx) => (
                <li key={idx} className="mb-2">{item.month}: <span className="font-bold">{formatCurrency(item.amount)} UF</span></li>
              ))}
            </ul>
            {/* Puedes expandir esto con más detalles */}
          </div>
        );
      case 'brokers':
        return (
          <div className="p-6 text-gray-700">
            <h3 className="text-lg font-semibold mb-4">Top Brokers</h3>
            <ul>
              {stats.brokerStats.slice(0, 5).map((broker, idx) => (
                <li key={idx} className="mb-2">{broker.name}: <span className="font-bold">{broker.reservations} reservas</span></li>
              ))}
            </ul>
          </div>
        );
      case 'pagos':
        return (
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
        );
      case 'cotizaciones':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3 items-stretch min-h-[400px]">
            {/* Cotizaciones Recientes */}
            <div className="h-full flex flex-col">
              <div className="bg-white rounded-xl shadow-none overflow-hidden h-full flex flex-col">
                <div className="border-b border-gray-200 pb-2 mb-2">
                  <h3 className="text-base font-semibold text-gray-900">Cotizaciones Recientes</h3>
                </div>
                <div className="divide-y divide-gray-200 flex-1">
                  {stats.recentQuotations.map((quotation) => (
                    <div 
                      key={quotation.id} 
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900">
                            {quotation.project_name} • {quotation.unit_number}
                          </p>
                          <p className="text-xs text-gray-500">
                            Broker: {quotation.broker_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Tipo: {quotation.tipologia}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs font-medium text-gray-900">
                            {formatCurrency(quotation.total_deed_price)} UF
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(quotation.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Cotizaciones del Mes (Gráfico) */}
            <div className="h-full flex flex-col">
              <div className="bg-white rounded-xl shadow-none overflow-hidden h-full flex flex-col justify-center items-center">
                <div className="flex-1 w-full h-full flex items-center justify-center">
                  <DashboardChart
                    title="Cotizaciones del Mes"
                    subtitle="Cotizaciones de los últimos 6 meses"
                    barsData={stats.monthlyQuotations.map(m => ({ value: m.count, label: m.month }))}
                    height="100%"
                    mode="unidades"
                    onModeChange={() => {}}
                    className="w-full h-full"
                  />
                </div>
              </div>
            </div>
            {/* Top Brokers */}
            <div className="h-full flex flex-col">
              <div className="bg-white rounded-xl shadow-none overflow-hidden h-full flex flex-col">
                <div className="border-b border-gray-200 pb-2 mb-2">
                  <h3 className="text-base font-semibold text-gray-900">Top Brokers</h3>
                </div>
                <div className="space-y-2 flex-1">
                  {stats.brokerQuotationStats.map((broker, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-900">{broker.broker_name}</p>
                        <p className="text-xs text-gray-500">
                          Hoy: {broker.today_quotations} • Semana: {broker.week_quotations} • Mes: {broker.month_quotations}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-blue-600">{broker.total_quotations}</p>
                        <p className="text-xs text-gray-500">total</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
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
      {/* Tarjetas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <DashboardCard
          title="Total Reservas"
          value={stats.totalReservations}
          icon={<ClipboardCheck className="h-6 w-6" />}
          trend={{ value: calculateTrend(stats.monthlyStats.reservations, stats.monthlyStats.previousReservations), isPositive: stats.monthlyStats.reservations >= stats.monthlyStats.previousReservations }}
        />
        <DashboardCard
          title="Total Clientes"
          value={stats.totalClients}
          icon={<Users className="h-6 w-6" />}
        />
        <DashboardCard
          title="Total Proyectos"
          value={stats.totalProjects}
          icon={<Building2 className="h-6 w-6" />}
        />
        <DashboardCard
          title="Total Brokers"
          value={stats.totalBrokers}
          icon={<Building className="h-6 w-6" />}
        />
        <DashboardCard
          title="Cotizaciones del Mes"
          value={stats.quotationStats.monthQuotations}
          icon={<FileText className="h-6 w-6" />}
          trend={{ value: 0, isPositive: true }}
        />
      </div>

      {/* Tabs de Informes */}
      <div className="mt-4">
        <div className="flex space-x-2 border-b border-gray-200 mb-3">
          <button
            className={`px-3 py-1.5 font-semibold text-xs border-b-2 transition-colors ${activeReport === 'reservas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-blue-600'}`}
            onClick={() => setActiveReport('reservas')}
          >
            Reservas del mes
          </button>
          <button
            className={`px-3 py-1.5 font-semibold text-xs border-b-2 transition-colors ${activeReport === 'comisiones' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-blue-600'}`}
            onClick={() => setActiveReport('comisiones')}
          >
            Comisiones
          </button>
          <button
            className={`px-3 py-1.5 font-semibold text-xs border-b-2 transition-colors ${activeReport === 'brokers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-blue-600'}`}
            onClick={() => setActiveReport('brokers')}
          >
            Brokers
          </button>
          <button
            className={`px-3 py-1.5 font-semibold text-xs border-b-2 transition-colors ${activeReport === 'pagos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-blue-600'}`}
            onClick={() => setActiveReport('pagos')}
          >
            Pagos
          </button>
          <button
            className={`px-3 py-1.5 font-semibold text-xs border-b-2 transition-colors ${activeReport === 'cotizaciones' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-blue-600'}`}
            onClick={() => setActiveReport('cotizaciones')}
          >
            Cotizaciones
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {activeReport === 'reservas' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
              {/* 1/3: Listado de reservas del mes */}
              <div className="col-span-1">
                <div className="bg-white rounded-xl shadow-none overflow-hidden">
                  <div className="border-b border-gray-200 pb-2 mb-2">
                    <h3 className="text-base font-semibold text-gray-900">Reservas del Mes</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {stats.recentActivity.reservations.map((reservation) => (
                      <div 
                        key={reservation.id} 
                        className="p-3 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleReservationClick(reservation.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            {reservation.seller_avatar ? (
                              <img
                                src={reservation.seller_avatar}
                                alt={reservation.seller_name || ''}
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <UserCircle className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900">
                              Reserva {reservation.reservation_number}
                            </p>
                            <p className="text-xs text-gray-500">
                              {reservation.project_name} • Depto. {reservation.apartment_number}
                            </p>
                            <p className="text-xs text-gray-500">
                              Cliente: {reservation.client_name}
                            </p>
                            <div className="mt-1 text-xs text-gray-500">
                              {reservation.seller_name && (
                                <span>Vendedor: {reservation.seller_name}</span>
                              )}
                              {reservation.broker_name && (
                                <span className="ml-2">• Broker: {reservation.broker_name}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-xs font-medium text-gray-900">
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
              </div>
              {/* 2/3: Gráfico de reservas del mes */}
              <div className="col-span-1 lg:col-span-2">
                <DashboardChart
                  title="Reservas del Mes"
                  subtitle="Reservas de los últimos 6 meses"
                  barsData={barsData}
                  height="100%"
                  mode={chartMode}
                  onModeChange={setChartMode}
                />
              </div>
            </div>
          ) : renderReportContent()}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;