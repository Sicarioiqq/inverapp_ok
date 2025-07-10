import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeTaskCountProps {
  userId: string | undefined;
  onCountUpdate: (count: number) => void;
}

export const useRealtimeTaskCount = ({ userId, onCountUpdate }: UseRealtimeTaskCountProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    if (!userId) {
      setIsConnected(false);
      return;
    }

    let mounted = true;

    const setupRealtimeSubscriptions = async () => {
      try {
        setError(null);
        
        // Limpiar suscripciones anteriores
        channelsRef.current.forEach(channel => {
          channel.unsubscribe();
        });
        channelsRef.current = [];

        // Suscripción a task_assignments (tareas de flujo de reservas)
        const taskAssignmentsChannel = supabase
          .channel('task_assignments_changes')
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'task_assignments',
              filter: `user_id=eq.${userId}`
            },
            async (payload) => {
              console.log('[RealtimeTaskCount] Evento recibido:', payload.eventType, payload);
              if (!mounted) return;
              await refreshTaskCount();
            }
          )
          .subscribe((status) => {
            if (mounted) {
              console.log('Task assignments subscription status:', status);
              setIsConnected(status === 'SUBSCRIBED');
            }
          });

        // Suscripción a commission_flow_tasks (tareas de flujo de pagos)
        const commissionTasksChannel = supabase
          .channel('commission_flow_tasks_changes')
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'commission_flow_tasks',
              filter: `assignee_id=eq.${userId}`
            },
            async (payload) => {
              console.log('[RealtimeTaskCount] Evento recibido:', payload.eventType, payload);
              if (!mounted) return;
              await refreshTaskCount();
            }
          )
          .subscribe((status) => {
            if (mounted) {
              console.log('Commission flow tasks subscription status:', status);
              setIsConnected(status === 'SUBSCRIBED');
            }
          });

        // Suscripción a collapsed_tasks (para actualizar cuando se ocultan/muestran tareas)
        const collapsedTasksChannel = supabase
          .channel('collapsed_tasks_changes')
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'collapsed_tasks',
              filter: `user_id=eq.${userId}`
            },
            async (payload) => {
              console.log('[RealtimeTaskCount] Evento recibido:', payload.eventType, payload);
              if (!mounted) return;
              await refreshTaskCount();
            }
          )
          .subscribe((status) => {
            if (mounted) {
              console.log('Collapsed tasks subscription status:', status);
              setIsConnected(status === 'SUBSCRIBED');
            }
          });

        // Suscripción a reservation_flows (para detectar cambios de estado)
        const reservationFlowsChannel = supabase
          .channel('reservation_flows_changes')
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'reservation_flows'
            },
            async (payload) => {
              console.log('[RealtimeTaskCount] Evento recibido:', payload.eventType, payload);
              if (!mounted) return;
              await refreshTaskCount();
            }
          )
          .subscribe((status) => {
            if (mounted) {
              console.log('Reservation flows subscription status:', status);
              setIsConnected(status === 'SUBSCRIBED');
            }
          });

        // Suscripción a commission_flows (para detectar cambios de estado)
        const commissionFlowsChannel = supabase
          .channel('commission_flows_changes')
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'commission_flows'
            },
            async (payload) => {
              console.log('[RealtimeTaskCount] Evento recibido:', payload.eventType, payload);
              if (!mounted) return;
              await refreshTaskCount();
            }
          )
          .subscribe((status) => {
            if (mounted) {
              console.log('Commission flows subscription status:', status);
              setIsConnected(status === 'SUBSCRIBED');
            }
          });

        // Suscripción a task_assignment_history (para detectar desasignaciones)
        const taskAssignmentHistoryChannel = supabase
          .channel('task_assignment_history_changes')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'task_assignment_history',
              filter: `user_id=eq.${userId}`
            },
            async (payload) => {
              console.log('[RealtimeTaskCount] Evento recibido en history:', payload.eventType, payload);
              if (!mounted) return;
              await refreshTaskCount();
            }
          )
          .subscribe((status) => {
            if (mounted) {
              console.log('Task assignment history subscription status:', status);
              setIsConnected(status === 'SUBSCRIBED');
            }
          });

        // Guardar referencias a los canales
        channelsRef.current = [
          taskAssignmentsChannel,
          commissionTasksChannel,
          collapsedTasksChannel,
          reservationFlowsChannel,
          commissionFlowsChannel,
          taskAssignmentHistoryChannel
        ];

        // Cargar el conteo inicial
        await refreshTaskCount();

      } catch (err) {
        console.error('Error setting up realtime subscriptions:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      }
    };

    const refreshTaskCount = async () => {
      try {
        // Get collapsed task IDs for the current user
        const { data: collapsedTasksData, error: collapsedError } = await supabase
          .from('collapsed_tasks')
          .select('task_assignment_id')
          .eq('user_id', userId)
          .gte('expires_at', new Date().toISOString());

        if (collapsedError) throw collapsedError;

        const collapsedTaskIds = new Set(collapsedTasksData?.map(ct => ct.task_assignment_id) || []);

        // Count pending sale flow tasks assigned to the user (excluding collapsed ones)
        const { data: saleTasksData, error: saleError } = await supabase
          .from('task_assignments')
          .select(`
            id,
            reservation_flow:reservation_flows!inner(status)
          `)
          .eq('user_id', userId)
          .neq('reservation_flow.status', 'pending');

        if (saleError) throw saleError;

        // Filter out collapsed tasks
        const visibleSaleTasks = saleTasksData?.filter(task => !collapsedTaskIds.has(task.id)) || [];

        // Count pending payment flow tasks assigned to the user
        const { data: paymentTasksData, error: paymentError } = await supabase
          .from('commission_flow_tasks')
          .select(`
            id,
            commission_flow:commission_flows!inner(status)
          `)
          .eq('assignee_id', userId)
          .neq('commission_flow.status', 'pending')
          .neq('status', 'completed')
          .neq('status', 'blocked');

        if (paymentError) throw paymentError;

        // Set the total count (excluding collapsed tasks)
        const totalCount = visibleSaleTasks.length + (paymentTasksData?.length || 0);
        
        if (mounted) {
          onCountUpdate(totalCount);
        }
      } catch (err) {
        console.error('Error refreshing task count:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Error al actualizar conteo');
        }
      }
    };

    setupRealtimeSubscriptions();

    return () => {
      mounted = false;
      // Limpiar suscripciones al desmontar
      channelsRef.current.forEach(channel => {
        channel.unsubscribe();
      });
      channelsRef.current = [];
    };
  }, [userId, onCountUpdate]);

  return {
    isConnected,
    error,
    reconnect: () => {
      // Forzar reconexión limpiando y recreando suscripciones
      channelsRef.current.forEach(channel => {
        channel.unsubscribe();
      });
      channelsRef.current = [];
      setIsConnected(false);
      setError(null);
    }
  };
}; 