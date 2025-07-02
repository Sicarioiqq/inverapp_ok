import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ClipboardList, Layout, List, ClipboardCheck, EyeOff, Clock, Eye } from 'lucide-react';
import LayoutPage from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import CollapsedTasksModal from '../components/CollapsedTasksModal';

const TareasAsignadas = () => {
  const [tareas, setTareas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'tabla' | 'kanban'>('tabla');
  const [userId, setUserId] = useState<string | null>(null);
  const [filtroAsignadoA, setFiltroAsignadoA] = useState<string>('');
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [sortBy, setSortBy] = useState<string>('assigned_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  const [collapsingTask, setCollapsingTask] = useState<string | null>(null);
  const [showCollapsedModal, setShowCollapsedModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  // Cargar tareas contraídas del usuario
  useEffect(() => {
    if (!userId) return;
    const fetchCollapsedTasks = async () => {
      try {
        const { data: collapsedData, error } = await supabase
          .from('collapsed_tasks')
          .select('task_assignment_id')
          .eq('user_id', userId)
          .eq('scope', 'assigned_by_me')
          .gte('expires_at', new Date().toISOString());
        if (error) throw error;
        const collapsedIds = new Set(collapsedData?.map(ct => ct.task_assignment_id) || []);
        setCollapsedTasks(collapsedIds);
      } catch (err) {
        console.error('Error fetching collapsed tasks:', err);
      }
    };
    fetchCollapsedTasks();
  }, [userId]);

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

  // Filtrar tareas contraídas y agregar campo 'dias' a cada tarea para ordenamiento
  const tareasConDias = tareasFiltradasPorUsuario
    .filter(t => !collapsedTasks.has(t.id)) // Excluir tareas contraídas
    .map((t) => {
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

  const handleCollapseTask = async (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!userId) return;
    if (collapsedTasks.has(taskId)) return;
    setCollapsingTask(taskId);
    try {
      const { error } = await supabase
        .from('collapsed_tasks')
        .insert({
          user_id: userId,
          task_assignment_id: taskId,
          scope: 'assigned_by_me',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      if (error) throw error;
      setCollapsedTasks(prev => new Set([...prev, taskId]));
    } catch (err) {
      console.error('Error collapsing task:', err);
    } finally {
      setCollapsingTask(null);
    }
  };

  const handleExpandTask = async (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('collapsed_tasks')
        .delete()
        .eq('user_id', userId)
        .eq('task_assignment_id', taskId)
        .eq('scope', 'assigned_by_me');
      if (error) throw error;
      setCollapsedTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    } catch (err) {
      console.error('Error expanding task:', err);
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
            {collapsedTasks.size > 0 && (
              <button
                onClick={() => setShowCollapsedModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                title={`${collapsedTasks.size} tarea(s) oculta(s) temporalmente`}
              >
                <EyeOff className="h-4 w-4" />
                {collapsedTasks.size} oculta(s)
              </button>
            )}
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
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Acciones</th>
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
                      <td className="px-3 py-2">
                        <button
                          onClick={(e) => handleCollapseTask(t.id, e)}
                          disabled={collapsingTask === t.id}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded transition-colors disabled:opacity-50"
                          title="Contraer por 24 horas"
                        >
                          {collapsingTask === t.id ? (
                            <Clock className="h-3 w-3 animate-spin" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </button>
                      </td>
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
              const dias = t?.assigned_at ? calcularDias(t.assigned_at) : (t?.created_at ? calcularDias(t.created_at) : '-');
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
                    <div className="text-xs text-gray-700"><b>Días:</b> {dias}</div>
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
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={(e) => handleCollapseTask(t.id, e)}
                      disabled={collapsingTask === t.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded transition-colors disabled:opacity-50"
                      title="Contraer por 24 horas"
                    >
                      {collapsingTask === t.id ? (
                        <Clock className="h-3 w-3 animate-spin" />
                      ) : (
                        <EyeOff className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal propio para tareas ocultas en esta sección */}
        {showCollapsedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 relative">
              <h2 className="text-lg font-bold mb-4 text-orange-700 flex items-center gap-2">
                <EyeOff className="h-5 w-5" /> Tareas Ocultas Temporalmente
              </h2>
              <table className="w-full text-xs mb-4">
                <thead>
                  <tr className="bg-orange-100 text-orange-900">
                    <th className="px-2 py-1 font-semibold">Tarea</th>
                    <th className="px-2 py-1 font-semibold">Proyecto</th>
                    <th className="px-2 py-1 font-semibold">Reserva</th>
                    <th className="px-2 py-1 font-semibold">Cliente</th>
                    <th className="px-2 py-1 font-semibold">Depto</th>
                    <th className="px-2 py-1 font-semibold">Asignado a</th>
                    <th className="px-2 py-1 font-semibold">Días</th>
                    <th className="px-2 py-1 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...collapsedTasks].map(taskId => {
                    const t = tareas.find(tar => tar.id === taskId);
                    // Mismos mapeos que en la tabla principal
                    const reservationFlow = Array.isArray(t?.reservation_flow) ? t?.reservation_flow[0] : t?.reservation_flow;
                    const reservation = reservationFlow && reservationFlow.reservations ? (Array.isArray(reservationFlow.reservations) ? reservationFlow.reservations[0] : reservationFlow.reservations) : null;
                    const client = reservation && reservation.client ? (Array.isArray(reservation.client) ? reservation.client[0] : reservation.client) : null;
                    const project = reservation && reservation.project ? (Array.isArray(reservation.project) ? reservation.project[0] : reservation.project) : null;
                    const projectName = project ? project.name : '-';
                    const unitNumber = reservation?.apartment_number || '';
                    const proyectoUnidad = unitNumber ? `${projectName} - ${unitNumber}` : projectName;
                    const diasModal = t?.assigned_at ? calcularDias(t.assigned_at) : (t?.created_at ? calcularDias(t.created_at) : '-');
                    const cliente = client ? `${client.first_name} ${client.last_name}` : '-';
                    const reservation_number = reservation?.reservation_number || '-';
                    return (
                      <tr key={taskId} className="bg-orange-50">
                        <td className="px-2 py-1">{t?.task ? t.task.name : t?.task_id || '-'}</td>
                        <td className="px-2 py-1">{proyectoUnidad}</td>
                        <td className="px-2 py-1">{reservation_number}</td>
                        <td className="px-2 py-1">{cliente}</td>
                        <td className="px-2 py-1">{unitNumber || '-'}</td>
                        <td className="px-2 py-1">{t?.user ? `${t.user.first_name} ${t.user.last_name}` : '-'}</td>
                        <td className="px-2 py-1">{diasModal}</td>
                        <td className="px-2 py-1">
                          <button
                            onClick={e => handleExpandTask(taskId, e)}
                            className="bg-blue-100 text-blue-700 rounded px-2 py-1 hover:bg-blue-200 transition"
                          >
                            Restaurar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex justify-end">
                <button onClick={() => setShowCollapsedModal(false)} className="bg-gray-400 text-white rounded px-4 py-2 mt-2">Cerrar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutPage>
  );
};

export default TareasAsignadas; 