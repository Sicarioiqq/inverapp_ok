import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ClipboardList, Layout, List, ClipboardCheck } from 'lucide-react';
import LayoutPage from '../components/Layout';
import { useNavigate } from 'react-router-dom';

const TareasAsignadas = () => {
  const [tareas, setTareas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'tabla' | 'kanban'>('tabla');
  const [userId, setUserId] = useState<string | null>(null);
  const [filtroAsignadoA, setFiltroAsignadoA] = useState<string>('');
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [sortBy, setSortBy] = useState<string>('assigned_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchTareasYComentarios = async () => {
      if (!userId) return;
      setLoading(true);
      let tareasFiltradas: any[] = [];
      let comentarios: any[] = [];
      let rftasks: any[] = [];
      if (!mostrarHistorial) {
        // Tareas activas (asignadas)
        const { data: tareasData } = await supabase
          .from('task_assignments')
          .select(`*, assigned_at,
            user:profiles!user_id(id, first_name, last_name),
            task:sale_flow_tasks(id, name),
            reservation_flow:reservation_flows(
              reservation_id,
              status,
              reservations(
                reservation_number,
                apartment_number,
                client:clients(first_name, last_name),
                project:projects(name, stage)
              )
            )
          `)
          .eq('assigned_by', userId);
        tareasFiltradas = Array.isArray(tareasData) ? tareasData.filter((t: any) => t && t.user_id && t.user_id !== userId) : [];
      } else {
        // Historial de tareas completadas
        const { data: tareasData } = await supabase
          .from('task_assignment_history')
          .select(`*, assigned_at,
            user:profiles!user_id(id, first_name, last_name),
            task:sale_flow_tasks(id, name),
            reservation_flow:reservation_flows(
              reservation_id,
              status,
              reservations(
                reservation_number,
                apartment_number,
                client:clients(first_name, last_name),
                project:projects(name, stage)
              )
            )
          `)
          // .eq('assigned_by', userId); // Descomentar si el filtro es necesario
        tareasFiltradas = Array.isArray(tareasData) ? tareasData.filter((t: any) => t && t.user_id) : [];
          console.log('Tareas completadas (historial):', tareasFiltradas);
      }
      // Paso 2: Traer comentarios de todas las tareas visibles
      const pares = tareasFiltradas.map(t => ({ reservation_flow_id: t.reservation_flow_id, task_id: t.task_id }));
      if (pares.length > 0) {
        const { data: rftasksData } = await supabase
          .from('reservation_flow_tasks')
          .select('id, reservation_flow_id, task_id, status');
        rftasks = rftasksData || [];
        const idsRFT = rftasks
          ? rftasks.filter((rf: any) => pares.some(p => p.reservation_flow_id === rf.reservation_flow_id && p.task_id === rf.task_id)).map((rf: any) => rf.id)
          : [];
        if (idsRFT.length > 0) {
          const { data: commentsData } = await supabase
            .from('task_comments')
            .select('reservation_flow_task_id, content, created_at')
            .in('reservation_flow_task_id', idsRFT);
          comentarios = commentsData || [];
        }
      }
      // Merge: agregar los comentarios y el estado real a cada tarea
      const tareasConComentarios = tareasFiltradas.map(t => {
        const rft = rftasks?.find(rf => rf.reservation_flow_id === t.reservation_flow_id && rf.task_id === t.task_id);
        const comments = rft ? comentarios.filter(c => c.reservation_flow_task_id === rft.id) : [];
        // Agregar estado real
        const real_status = rft ? rft.status : undefined;
        return { ...t, comments, real_status };
      });
      setTareas(tareasConComentarios);
      setLoading(false);
    };
    fetchTareasYComentarios();
  }, [userId, mostrarHistorial]);

  const calcularDias = (fecha: string) => {
    const asignada = new Date(fecha);
    const hoy = new Date();
    const diff = Math.floor((hoy.getTime() - asignada.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getEstadoVisual = (estado: string): { label: string; color: string } => {
    switch (estado) {
      case 'in_progress': return { label: 'Pendiente', color: 'bg-yellow-200 text-yellow-800' };
      case 'pending': return { label: 'Pendiente', color: 'bg-yellow-200 text-yellow-800' };
      case 'completed': return { label: 'Completada', color: 'bg-green-200 text-green-800' };
      case 'blocked': return { label: 'Bloqueada', color: 'bg-red-200 text-red-800' };
      default: return { label: estado || 'Otro', color: 'bg-gray-300 text-gray-800' };
    }
  };

  // Obtener lista de usuarios únicos asignados
  const usuariosAsignados = Array.from(new Set(tareas.map(t => t.user ? `${t.user.first_name} ${t.user.last_name}` : ''))).filter(Boolean);
  // Filtrar tareas según filtroAsignadoA y mostrarHistorial
  let tareasFiltradasPorUsuario = filtroAsignadoA ? tareas.filter(t => t.user && `${t.user.first_name} ${t.user.last_name}` === filtroAsignadoA) : tareas;

  const cincoDiasMs = 5 * 24 * 60 * 60 * 1000;
  const ahora = new Date();

  if (mostrarHistorial) {
    // Solo completadas de los últimos 5 días
    tareasFiltradasPorUsuario = tareasFiltradasPorUsuario.filter(t => {
      if (!t.completed_at) return false;
      const fechaCompleto = new Date(t.completed_at);
      return (ahora.getTime() - fechaCompleto.getTime()) <= cincoDiasMs;
    });
  } else {
    // Pendientes + completadas de los últimos 5 días
    tareasFiltradasPorUsuario = tareasFiltradasPorUsuario.filter(t => {
      if (t.real_status === 'completed') {
        if (!t.completed_at) return false;
        const fechaCompleto = new Date(t.completed_at);
        return (ahora.getTime() - fechaCompleto.getTime()) <= cincoDiasMs;
      }
      // Mostrar todas las pendientes
      return t.real_status !== 'blocked';
    });
  }

  // Agregar campo 'dias' a cada tarea para ordenamiento
  const tareasConDias = tareasFiltradasPorUsuario.map((t) => {
    const dias = t.assigned_at ? calcularDias(t.assigned_at) : -1;
    return { ...t, dias };
  });

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
  };

  const tareasOrdenadas = [...tareasConDias].sort((a, b) => {
    const valA = a[sortBy] ?? '';
    const valB = b[sortBy] ?? '';
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <LayoutPage>
      <div className="max-w-6xl mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-green-600" /> Tareas Asignadas por Mí
          </h1>
          <div className="flex gap-4 items-center">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={filtroAsignadoA}
              onChange={e => setFiltroAsignadoA(e.target.value)}
            >
              <option value="">Todos los asignados</option>
              {usuariosAsignados.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <button
              onClick={() => setVista(vista === 'tabla' ? 'kanban' : 'tabla')}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded"
            >
              {vista === 'tabla' ? <Layout className="h-5 w-5" /> : <List className="h-5 w-5" />}
              {vista === 'tabla' ? 'Vista Kanban' : 'Vista Tabla'}
            </button>
            <button
              onClick={() => setMostrarHistorial(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded ${mostrarHistorial ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {mostrarHistorial ? 'Ver tareas activas' : 'Ver completadas'}
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-10 text-gray-500">Cargando tareas...</div>
        ) : tareas.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No hay tareas asignadas por ti a otros usuarios.</div>
        ) : vista === 'tabla' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 bg-white rounded shadow">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('task_id')}>Tarea {sortBy === 'task_id' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('user_id')}>Asignado a {sortBy === 'user_id' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('estado')}>Estado {sortBy === 'estado' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('reservation_number')}>Reserva {sortBy === 'reservation_number' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('cliente')}>Cliente {sortBy === 'cliente' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('proyectoUnidad')}>Proyecto {sortBy === 'proyectoUnidad' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('assigned_at')}>Fecha {sortBy === 'assigned_at' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('dias')}>Días {sortBy === 'dias' && (sortOrder === 'asc' ? '▲' : '▼')}</th>
                </tr>
              </thead>
              <tbody>
                {tareasOrdenadas.map((t) => {
                  const reservationFlow = Array.isArray(t.reservation_flow) ? t.reservation_flow[0] : t.reservation_flow;
                  const reservation = reservationFlow && reservationFlow.reservations ? (Array.isArray(reservationFlow.reservations) ? reservationFlow.reservations[0] : reservationFlow.reservations) : null;
                  const client = reservation && reservation.client ? (Array.isArray(reservation.client) ? reservation.client[0] : reservation.client) : null;
                  const project = reservation && reservation.project ? (Array.isArray(reservation.project) ? reservation.project[0] : reservation.project) : null;
                  const estadoTarea = t.real_status || reservationFlow?.status || '-';
                  const estadoVisual = getEstadoVisual(estadoTarea);
                  const comments = t.comments || [];
                  const projectName = project ? project.name : '-';
                  const unitNumber = reservation?.apartment_number || '';
                  const proyectoUnidad = unitNumber ? `${projectName} - ${unitNumber}` : projectName;
                  const dias = t.dias >= 0 ? t.dias : '-';
                  const cliente = client ? `${client.first_name} ${client.last_name}` : '-';
                  const reservation_number = reservation?.reservation_number || '-';
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 cursor-pointer text-xs"
                      style={{ fontSize: '0.85rem' }}
                      onClick={() => t.reservation_flow_id && navigate(`/flujo-reservas/${t.reservation_flow_id}`)}
                    >
                      <td className="px-3 py-2 font-medium">{t.task ? t.task.name : t.task_id}</td>
                      <td className="px-3 py-2">{t.user ? `${t.user.first_name} ${t.user.last_name}` : '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${estadoVisual.color}`}>{estadoVisual.label}</span>
                      </td>
                      <td className="px-3 py-2">{reservation_number}</td>
                      <td className="px-3 py-2">{cliente}</td>
                      <td className="px-3 py-2">{proyectoUnidad}</td>
                      <td className="px-3 py-2">{t.assigned_at ? new Date(t.assigned_at).toLocaleDateString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}</td>
                      <td className="px-3 py-2">{dias}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {tareasFiltradasPorUsuario.map((t) => {
              const reservationFlow = Array.isArray(t.reservation_flow) ? t.reservation_flow[0] : t.reservation_flow;
              const reservation = reservationFlow && reservationFlow.reservations ? (Array.isArray(reservationFlow.reservations) ? reservationFlow.reservations[0] : reservationFlow.reservations) : null;
              const client = reservation && reservation.client ? (Array.isArray(reservation.client) ? reservation.client[0] : reservation.client) : null;
              const project = reservation && reservation.project ? (Array.isArray(reservation.project) ? reservation.project[0] : reservation.project) : null;
              const estadoTarea = t.real_status || reservationFlow?.status || '-';
              const estadoVisual = getEstadoVisual(estadoTarea);
              const comments = t.comments || [];
              const projectName = project ? project.name : '-';
              const unitNumber = reservation?.apartment_number || '';
              const proyectoUnidad = unitNumber ? `${projectName} - ${unitNumber}` : projectName;
              // Nuevo: fallback para días
              const dias = t.assigned_at ? calcularDias(t.assigned_at) : (t.created_at ? calcularDias(t.created_at) : -1);
              console.log('Tarea Kanban:', t); // Depuración
              return (
                <div
                  key={t.id}
                  className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 mb-2 hover:shadow-2xl transition-shadow cursor-pointer flex flex-col gap-2 text-[0.85rem] relative"
                  style={{ minHeight: 180 }}
                  onClick={() => t.reservation_flow_id && navigate(`/flujo-reservas/${t.reservation_flow_id}`)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={e => { if (e.key === 'Enter' && t.reservation_flow_id) navigate(`/flujo-reservas/${t.reservation_flow_id}`); }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardCheck className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-base">{t.task ? t.task.name : t.task_id}</span>
                  </div>
                  <span className={`absolute top-4 right-4 inline-block rounded px-2 py-1 text-xs font-semibold ${estadoVisual.color}`}>{estadoVisual.label}</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                    <div className="text-xs text-gray-700"><b>Asignado a:</b> {t.user ? `${t.user.first_name} ${t.user.last_name}` : '-'}</div>
                    <div className="text-xs text-gray-700"><b>Fecha:</b> {t.assigned_at ? new Date(t.assigned_at).toLocaleDateString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}</div>
                    <div className="text-xs text-gray-700"><b>Reserva:</b> {reservation?.reservation_number || '-'}</div>
                    <div className="text-xs text-gray-700"><b>Cliente:</b> {client ? `${client.first_name} ${client.last_name}` : '-'}</div>
                    <div className="text-xs text-gray-700"><b>Proyecto:</b> {proyectoUnidad}</div>
                    <div className="text-xs text-gray-700"><b>Días:</b> {dias >= 0 ? dias : '-'}</div>
                  </div>
                  {comments.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600 col-span-3">
                      <b>Comentarios:</b>
                      <ul className="list-disc ml-4">
                        {comments.map((c: any, idx: number) => (
                          <li key={idx}>{c.content}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </LayoutPage>
  );
};

export default TareasAsignadas; 