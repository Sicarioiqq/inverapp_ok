import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '../lib/supabase';
import LayoutPage from '../components/Layout';

const CalendarPage = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTareas = async () => {
      setLoading(true);
      // Demo: buscar tareas asignadas al usuario actual (puedes ajustar la query según tu modelo)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: tareas } = await supabase
        .from('task_assignments')
        .select('id, assigned_at, task:sale_flow_tasks(name), reservation_flow:reservation_flows(reservations(reservation_number, apartment_number, client:clients(first_name, last_name), project:projects(name)))')
        .or(`user_id.eq.${user.id},assigned_by.eq.${user.id}`);
      // Mapear tareas a eventos de calendario
      const mapped = (tareas || []).map((t: any) => {
        const reservation = t.reservation_flow?.reservations;
        const client = reservation?.client;
        const project = reservation?.project;
        return {
          id: t.id,
          title: `${t.task?.name || 'Tarea'}${reservation ? ' - ' + reservation.reservation_number : ''}`,
          start: t.assigned_at,
          extendedProps: {
            cliente: client ? `${client.first_name} ${client.last_name}` : '',
            depto: reservation?.apartment_number || '',
            proyecto: project?.name || '',
          },
        };
      });
      setEvents(mapped);
      setLoading(false);
    };
    fetchTareas();
  }, []);

  return (
    <LayoutPage>
      <div className="max-w-6xl mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Calendario de Tareas</h1>
        {loading ? (
          <div className="text-center py-10 text-gray-500">Cargando tareas...</div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            height="auto"
            events={events}
            eventClick={info => {
              const { title, start, extendedProps } = info.event;
              alert(`Tarea: ${title}\nFecha: ${start?.toLocaleString()}\nCliente: ${extendedProps.cliente}\nDepto: ${extendedProps.depto}\nProyecto: ${extendedProps.proyecto}`);
            }}
            locale="es"
            buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
          />
        )}
      </div>
    </LayoutPage>
  );
};

export default CalendarPage; 