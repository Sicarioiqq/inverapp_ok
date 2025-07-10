import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { usePopup } from '../contexts/PopupContext';
import { useNavigate } from 'react-router-dom';

interface TaskAssignment {
  id: string;
  user_id: string;
  task_id: string;
  reservation_flow_id?: string;
  created_at: string;
  // Datos enriquecidos:
  task_name?: string;
  project_name?: string;
  apartment_number?: string;
  client_name?: string;
  broker_name?: string;
}

export function useTaskAssignmentModal(userProfile?: { id: string; first_name: string }) {
  const { showPopup, hidePopup } = usePopup();
  const navigate = useNavigate();
  const channelRef = useRef<any>(null);
  const historyChannelRef = useRef<any>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Suscripción para asignaciones nuevas
  useEffect(() => {
    if (!userProfile?.id) {
      console.log('[TaskAssignmentModal] userProfile no definido, no se monta suscripción');
      return;
    }
    // Si ya hay un canal anterior, eliminarlo
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    console.log('[TaskAssignmentModal] Montando suscripción realtime para user_id:', userProfile.id);
    const channel = supabase
      .channel('task-assignments-modal')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignments' },
        async (payload) => {
          const newData = payload.new as any | undefined;
          const oldData = payload.old as any | undefined;
          let userIdEvento = undefined;
          if (newData && 'user_id' in newData) userIdEvento = newData.user_id;
          else if (oldData && 'user_id' in oldData) userIdEvento = oldData.user_id;
          console.log('[TaskAssignmentModal] Evento recibido:', payload, 'user_id evento:', userIdEvento, 'user actual:', userProfile.id);
          if (userIdEvento !== userProfile.id) return;
          if (payload.eventType === 'INSERT') {
            // Enriquecer con datos de la tarea y reserva
            const task: TaskAssignment = (payload.new as any);
            const { data, error } = await supabase
              .from('task_assignments')
              .select(`
                id,
                created_at,
                task:sale_flow_tasks(name),
                reservation_flow:reservation_flows(
                  id,
                  reservation:reservations(
                    apartment_number,
                    client:clients(first_name, last_name),
                    broker:brokers(name),
                    project:projects(name)
                  )
                )
              `)
              .eq('id', task.id)
              .maybeSingle();
            if (!data) {
              console.log('[TaskAssignmentModal] No se pudo enriquecer la tarea, data null');
              return;
            }
            // Corrección de tipado para evitar errores de never
            const taskArr = data.task as { name?: string }[] | undefined;
            let taskName = '';
            if (Array.isArray(taskArr) && taskArr.length > 0 && typeof taskArr[0] === 'object' && 'name' in taskArr[0]) {
              taskName = (taskArr[0] as { name?: string }).name || '';
            } else if (data.task && typeof data.task === 'object' && 'name' in data.task) {
              taskName = (data.task as { name?: string }).name || '';
            }
            const reservationFlowArr = data.reservation_flow as any[] | undefined;
            const reservationFlow = Array.isArray(reservationFlowArr) ? (reservationFlowArr[0] || undefined) : data.reservation_flow;
            const reservationArr = reservationFlow?.reservation as any[] | undefined;
            const reservation = reservationFlow?.reservation ? (Array.isArray(reservationArr) ? (reservationArr[0] || undefined) : reservationFlow.reservation) : undefined;
            const projectArr = reservation?.project as { name?: string }[] | undefined;
            const projectName = reservation?.project ? (Array.isArray(projectArr) ? (projectArr[0]?.name || '') : (reservation.project?.name || '')) : '';
            const apartmentNumber = reservation?.apartment_number || '';
            const clientArr = reservation?.client as { first_name?: string; last_name?: string }[] | undefined;
            const clientName = reservation?.client ? (Array.isArray(clientArr) ? `${clientArr[0]?.first_name || ''} ${clientArr[0]?.last_name || ''}` : `${reservation.client?.first_name || ''} ${reservation.client?.last_name || ''}`) : '';
            const brokerArr = reservation?.broker as { name?: string }[] | undefined;
            const brokerName = reservation?.broker ? (Array.isArray(brokerArr) ? (brokerArr[0]?.name || '') : (reservation.broker?.name || '')) : '';
            console.log('[TaskAssignmentModal] Mostrando modal para tarea:', taskName, 'proyecto:', projectName, 'user_id evento:', userIdEvento, 'user actual:', userProfile.id);
            showPopup(
              <div className="space-y-4">
                <div className="text-lg font-semibold text-gray-900 mb-2">
                  Hola, {userProfile.first_name}
                </div>
                <div className="text-base text-gray-800">Tienes una nueva tarea asignada:</div>
                <div className="bg-gray-50 rounded p-3 border">
                  <div><span className="font-semibold">Tarea:</span> {taskName}</div>
                  <div><span className="font-semibold">Proyecto:</span> {projectName}</div>
                  <div><span className="font-semibold">Unidad:</span> {apartmentNumber}</div>
                  {clientName && <div><span className="font-semibold">Cliente:</span> {clientName}</div>}
                  {brokerName && <div><span className="font-semibold">Broker:</span> {brokerName}</div>}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                    onClick={hidePopup}
                  >
                    Cerrar
                  </button>
                  <button
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => {
                      hidePopup();
                      if (reservationFlow?.id) {
                        navigate(`/flujo-reservas/${reservationFlow.id}`);
                      }
                    }}
                  >
                    Ir a la tarea
                  </button>
                </div>
              </div>,
              { title: 'Nueva tarea asignada', size: 'md' }
            );
          }
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        console.log('[TaskAssignmentModal] Canal realtime eliminado');
      }
    };
  }, [userProfile?.id, userProfile?.first_name, navigate]);

  // Suscripción para desasignaciones (history)
  useEffect(() => {
    if (!userProfile?.id) return;
    if (historyChannelRef.current) {
      supabase.removeChannel(historyChannelRef.current);
      historyChannelRef.current = null;
    }
    const historyChannel = supabase
      .channel('task-assignment-history-modal')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_assignment_history' },
        async (payload) => {
          const newData = payload.new as any | undefined;
          let userIdEvento = undefined;
          if (newData && 'user_id' in newData) userIdEvento = newData.user_id;
          console.log('[TaskAssignmentModal] Evento history recibido:', payload, 'user_id evento:', userIdEvento, 'user actual:', userProfile.id);
          if (userIdEvento !== userProfile.id) return;

          // Debounce para evitar modales múltiples o cierres/reaperturas rápidas
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(async () => {
            // Obtener información enriquecida de la tarea desasignada
            let taskName = '';
            let projectName = '';
            let apartmentNumber = '';
            let clientName = '';
            let brokerName = '';
            let status = newData?.status || '';
            let unassignedBy = '';

            // 1. Buscar nombre de la tarea
            if (newData?.task_id) {
              const { data: taskData } = await supabase
                .from('sale_flow_tasks')
                .select('name')
                .eq('id', newData.task_id)
                .maybeSingle();
              if (taskData && taskData.name) {
                taskName = taskData.name;
              }
            }
            // 2. Buscar datos de la reserva y relaciones
            if (newData?.reservation_flow_id) {
              const { data: flowData } = await supabase
                .from('reservation_flows')
                .select(`
                  id,
                  reservation:reservations(
                    apartment_number,
                    client:clients(first_name, last_name),
                    broker:brokers(name),
                    project:projects(name)
                  )
                `)
                .eq('id', newData.reservation_flow_id)
                .maybeSingle();
              if (flowData && flowData.reservation) {
                const reservation = Array.isArray(flowData.reservation) ? flowData.reservation[0] : flowData.reservation;
                projectName = reservation?.project?.name || '';
                apartmentNumber = reservation?.apartment_number || '';
                clientName = reservation?.client ? `${reservation.client.first_name || ''} ${reservation.client.last_name || ''}` : '';
                brokerName = reservation?.broker?.name || '';
              }
            }
            // Quién desasignó (removed_by)
            if (newData?.removed_by) {
              const { data: removedByProfile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', newData.removed_by)
                .maybeSingle();
              if (removedByProfile) {
                unassignedBy = `${removedByProfile.first_name || ''} ${removedByProfile.last_name || ''}`;
              }
            }
            // Status
            status = newData?.status || status;

            showPopup(
              <div className="space-y-4">
                <div className="text-lg font-semibold text-gray-900 mb-2">
                  Hola, {userProfile.first_name}
                </div>
                <div className="text-base text-gray-800">Se te ha desasignado una tarea.</div>
                <div className="bg-gray-50 rounded p-3 border">
                  <div><span className="font-semibold">Tarea:</span> {taskName || 'Tarea desconocida'}</div>
                  {projectName && <div><span className="font-semibold">Proyecto:</span> {projectName}</div>}
                  {apartmentNumber && <div><span className="font-semibold">Unidad:</span> {apartmentNumber}</div>}
                  {clientName && <div><span className="font-semibold">Cliente:</span> {clientName}</div>}
                  {brokerName && <div><span className="font-semibold">Broker:</span> {brokerName}</div>}
                  {status === 'completed' ? (
                    <div className="mt-2 text-green-700 font-semibold">Tarea completada</div>
                  ) : (
                    unassignedBy && <div className="mt-2 text-gray-700">Desasignada por: <b>{unassignedBy}</b></div>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                    onClick={hidePopup}
                  >
                    Cerrar
                  </button>
                </div>
              </div>,
              { title: 'Tarea desasignada', size: 'md' }
            );
          }, 200); // 200ms debounce
        }
      )
      .subscribe();
    historyChannelRef.current = historyChannel;
    return () => {
      if (historyChannelRef.current) {
        supabase.removeChannel(historyChannelRef.current);
        historyChannelRef.current = null;
        console.log('[TaskAssignmentModal] Canal history eliminado');
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [userProfile?.id, userProfile?.first_name, hidePopup, showPopup]);
} 