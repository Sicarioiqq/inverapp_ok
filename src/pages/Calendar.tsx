import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '../lib/supabase';
import LayoutPage from '../components/Layout';
import { Dialog } from '@headlessui/react';
import { Plus, Edit, Trash2, Calendar, Clock, User, MapPin } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  description?: string;
  location?: string;
  type: 'gestion' | 'reunion' | 'visita' | 'otro';
  color?: string;
  created_by: string;
  created_at: string;
  reservation_flow_id?: string;
  reservation_flow_task_id?: string;
}

const CalendarPage = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    location: '',
    type: 'gestion' as 'gestion' | 'reunion' | 'visita' | 'otro',
    start: '',
    end: ''
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener eventos personalizados del calendario
      const { data: calendarEvents, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('created_by', user.id)
        .order('start', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        return;
      }

      setEvents(calendarEvents || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (arg: any) => {
    setSelectedDate(arg.dateStr);
    setSelectedEvent(null);
    setEventForm({
      title: '',
      description: '',
      location: '',
      type: 'gestion',
      start: arg.dateStr,
      end: arg.dateStr
    });
    setShowEventModal(true);
  };

  const handleEventClick = (info: any) => {
    const event = events.find(e => e.id === info.event.id);
    if (event) {
      setSelectedEvent(event);
      setEventForm({
        title: event.title,
        description: event.description || '',
        location: event.location || '',
        type: event.type,
        start: event.start,
        end: event.end || event.start
      });
      setShowEventModal(true);
    }
  };

  const handleSaveEvent = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const eventData = {
        title: eventForm.title,
        description: eventForm.description,
        location: eventForm.location,
        type: eventForm.type,
        start: eventForm.start,
        end: eventForm.end || eventForm.start,
        created_by: user.id
      };

      if (selectedEvent) {
        // Actualizar evento existente
        const { error } = await supabase
          .from('calendar_events')
          .update(eventData)
          .eq('id', selectedEvent.id);

        if (error) throw error;
      } else {
        // Crear nuevo evento
        const { error } = await supabase
          .from('calendar_events')
          .insert(eventData);

        if (error) throw error;
      }

      setShowEventModal(false);
      setSelectedEvent(null);
      setEventForm({
        title: '',
        description: '',
        location: '',
        type: 'gestion',
        start: '',
        end: ''
      });
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Error al guardar el evento');
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    if (confirm('¿Estás seguro de que quieres eliminar este evento?')) {
      try {
        const { error } = await supabase
          .from('calendar_events')
          .delete()
          .eq('id', selectedEvent.id);

        if (error) throw error;

        setShowEventModal(false);
        setSelectedEvent(null);
        fetchEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Error al eliminar el evento');
      }
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'gestion': return '#3B82F6'; // blue
      case 'reunion': return '#10B981'; // green
      case 'visita': return '#F59E0B'; // amber
      case 'otro': return '#6B7280'; // gray
      default: return '#3B82F6';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'gestion': return 'Gestión';
      case 'reunion': return 'Reunión';
      case 'visita': return 'Visita';
      case 'otro': return 'Otro';
      default: return 'Gestión';
    }
  };

  const mappedEvents = events.map(event => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    backgroundColor: getEventColor(event.type),
    borderColor: getEventColor(event.type),
    extendedProps: {
      description: event.description,
      location: event.location,
      type: event.type
    }
  }));

  return (
    <LayoutPage>
      <div className="max-w-6xl mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Calendario de Gestiones</h1>
          <button
            onClick={() => {
              setSelectedEvent(null);
              setEventForm({
                title: '',
                description: '',
                location: '',
                type: 'gestion',
                start: new Date().toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              });
              setShowEventModal(true);
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Gestión
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Cargando calendario...</div>
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
            events={mappedEvents}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            locale="es"
            buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
            selectable={true}
            editable={false}
            dayMaxEvents={true}
          />
        )}

        {/* Modal para crear/editar eventos */}
        <Dialog open={showEventModal} onClose={() => setShowEventModal(false)} className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black opacity-30"></div>
            <Dialog.Panel className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
              <Dialog.Title className="text-xl font-bold mb-4">
                {selectedEvent ? 'Editar Gestión' : 'Nueva Gestión'}
              </Dialog.Title>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Título de la gestión"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={eventForm.type}
                    onChange={(e) => setEventForm({...eventForm, type: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="gestion">Gestión</option>
                    <option value="reunion">Reunión</option>
                    <option value="visita">Visita</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={eventForm.description}
                    onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Descripción de la gestión"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ubicación
                  </label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ubicación"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha inicio *
                    </label>
                    <input
                      type="date"
                      value={eventForm.start}
                      onChange={(e) => setEventForm({...eventForm, start: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha fin
                    </label>
                    <input
                      type="date"
                      value={eventForm.end}
                      onChange={(e) => setEventForm({...eventForm, end: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                {selectedEvent && selectedEvent.reservation_flow_id && (
                  <button
                    type="button"
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm mr-2"
                    onClick={() => {
                      let url = `/flujo-reservas/${selectedEvent.reservation_flow_id}`;
                      if (selectedEvent.reservation_flow_task_id) {
                        url += `?tarea=${selectedEvent.reservation_flow_task_id}`;
                      }
                      window.location.href = url;
                    }}
                  >
                    Flujo Reserva
                  </button>
                )}
                {selectedEvent && (
                  <button
                    onClick={handleDeleteEvent}
                    className="px-4 py-2 text-red-600 hover:text-red-800 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEvent}
                  disabled={!eventForm.title || !eventForm.start}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {selectedEvent ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </div>
    </LayoutPage>
  );
};

export default CalendarPage; 