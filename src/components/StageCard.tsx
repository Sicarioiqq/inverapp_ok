import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Clock, AlertCircle, UserPlus, MessageSquare, Loader2, UserCircle, Calendar, Lock, CalendarPlus } from 'lucide-react';
import { usePopup } from '../contexts/PopupContext';
import TaskCommentList from './TaskCommentList';
import CalendarEventModal from './CalendarEventModal';

interface Task {
  id: string;
  name: string;
  status: string;
  completed_at?: string;
  assignees: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  }[];
  comments_count: number;
}

interface StageCardProps {
  title: string;
  tasks: Task[];
  isCompleted: boolean;
  onAssign: (taskId: string) => void;
  onComment: (taskId: string) => void;
  onStatusChange: (taskId: string, status: string, completedAt?: string) => void;
  reservationFlowId: string;
  isAdmin?: boolean;
  projectName: string;
  apartmentNumber: string;
}

const StageCard: React.FC<StageCardProps> = ({
  title,
  tasks,
  isCompleted,
  onAssign,
  onComment,
  onStatusChange,
  reservationFlowId,
  isAdmin = false,
  projectName,
  apartmentNumber
}) => {
  const [isExpanded, setIsExpanded] = useState(!isCompleted);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<{[key: string]: boolean}>({});
  const [editingDate, setEditingDate] = useState<{[key: string]: boolean}>({});
  const { showPopup } = usePopup();
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Add a refresh trigger state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarModalTask, setCalendarModalTask] = useState<Task | null>(null);
  const [calendarModalDefaultDate, setCalendarModalDefaultDate] = useState<string>('');
  const [calendarModalTitle, setCalendarModalTitle] = useState<string>('');

  useEffect(() => {
    const activeTasks = tasks.filter(task => 
      (task.status === 'pending' || task.status === 'in_progress') &&
      task.comments_count > 0
    );
    
    if (activeTasks.length > 0) {
      setExpandedTaskId(activeTasks[0].id);
    } else {
      setExpandedTaskId(null);
    }
  }, [tasks]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'blocked':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completada';
      case 'in_progress':
        return 'En Proceso';
      case 'blocked':
        return 'Bloqueada';
      default:
        return 'Pendiente';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    setSavingStatus(prev => ({ ...prev, [taskId]: true }));
    try {
      await onStatusChange(taskId, status);
      // Trigger a refresh of comments after status change
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error al cambiar estado:', error);
    } finally {
      setSavingStatus(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleDateChange = async (taskId: string, date: string) => {
    setSavingStatus(prev => ({ ...prev, [taskId]: true }));
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        await onStatusChange(taskId, task.status, date);
        // Trigger a refresh of comments after date change
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error al cambiar fecha:', error);
    } finally {
      setSavingStatus(prev => ({ ...prev, [taskId]: false }));
      setEditingDate(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleCommentClick = (taskId: string) => {
    onComment(taskId);
    // After adding a comment, we'll refresh the comments list
    setTimeout(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 500);
  };

  const toggleTaskComments = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
    // Refresh comments when expanding a task
    if (expandedTaskId !== taskId) {
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const shouldShowComments = (task: Task) => {
    return (
      expandedTaskId === task.id || 
      ((task.status === 'pending' || task.status === 'in_progress') && 
       task.comments_count > 0)
    );
  };

  const formatDate = (dateString: string) => {
    try {
      // Parse the date string
      const date = new Date(dateString);
      
      // Format as DD-MM-YYYY
      return date.toLocaleDateString();
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  const handleAgendarGestion = (task: Task) => {
    const title = `${projectName} - ${apartmentNumber} - ${task.name}`;
    setCalendarModalTitle(title);
    setCalendarModalDefaultDate(new Date().toISOString().split('T')[0]);
    setCalendarModalTask(task);
    setShowCalendarModal(true);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div 
        className={`p-4 flex items-center justify-between cursor-pointer ${isCompleted ? 'bg-gray-50' : 'bg-white'}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          {isExpanded ? <ChevronDown className="h-5 w-5 mr-2" /> : <ChevronRight className="h-5 w-5 mr-2" />}
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          {isCompleted && (
            <span className="ml-3 px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
              Completada
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200">
          {tasks.map((task) => (
            <div 
              key={task.id}
              id={`tarea-${task.id}`}
              className="border-b border-gray-200 last:border-b-0"
            >
              <div className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {savingStatus[task.id] ? (
                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                      ) : (
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                          disabled={!isAdmin && task.status === 'completed'}
                          className={`flex items-center space-x-2 text-sm rounded-md border-gray-300 ${getStatusColor(task.status)} focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <option value="pending">Pendiente</option>
                          <option value="in_progress">En Proceso</option>
                          <option value="completed">Completada</option>
                          <option value="blocked">Bloqueada</option>
                        </select>
                      )}
                      <span className="ml-2">{task.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    {task.status === 'completed' && (
                      <div className="flex items-center space-x-2">
                        {editingDate[task.id] && isAdmin ? (
                          <input
                            type="datetime-local"
                            defaultValue={task.completed_at?.split('.')[0]}
                            onChange={(e) => handleDateChange(task.id, e.target.value)}
                            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <div className="flex items-center space-x-1">
                            <span className="text-sm text-gray-500">
                              Completada el {formatDate(task.completed_at || '')}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => setEditingDate(prev => ({ ...prev, [task.id]: true }))}
                                className="ml-2 text-blue-600 hover:text-blue-800"
                                title="Editar fecha"
                              >
                                <Calendar className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {task.status === 'blocked' && (
                      <div className="ml-2 flex items-center text-gray-500" title="Tarea bloqueada">
                        <Lock className="h-4 w-4" />
                      </div>
                    )}

                    <div className="flex -space-x-2">
                      {task.assignees.map((assignee) => (
                        <div
                          key={assignee.id}
                          className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center overflow-hidden"
                          title={`${assignee.first_name} ${assignee.last_name}`}
                        >
                          {assignee.avatar_url ? (
                            <img 
                              src={assignee.avatar_url} 
                              alt={`${assignee.first_name} ${assignee.last_name}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserCircle className="h-6 w-6 text-gray-500" />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleAgendarGestion(task)}
                        className="p-1 text-blue-500 hover:text-blue-700"
                        title="Agendar gestión en calendario"
                      >
                        <CalendarPlus className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => onAssign(task.id)}
                        className={`p-1 text-gray-400 hover:text-gray-600 ${task.status === 'completed' && !isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Asignar responsables"
                        disabled={task.status === 'completed' && !isAdmin}
                      >
                        <UserPlus className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleCommentClick(task.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 relative"
                        title="Agregar comentario"
                      >
                        <MessageSquare className="h-5 w-5" />
                        {task.comments_count > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 text-xs flex items-center justify-center bg-blue-600 text-white rounded-full">
                            {task.comments_count}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => toggleTaskComments(task.id)}
                        className={`p-1 text-gray-400 hover:text-gray-600 transition-transform ${expandedTaskId === task.id ? 'rotate-180' : ''}`}
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {shouldShowComments(task) && (
                <div className="bg-gray-50 p-4 border-t border-gray-200">
                  <TaskCommentList 
                    taskId={task.id} 
                    reservationFlowId={reservationFlowId} 
                    refreshTrigger={refreshTrigger} // Pass the refresh trigger
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Modal de agendar gestión */}
      {showCalendarModal && calendarModalTask && (
        <CalendarEventModal
          open={showCalendarModal}
          onClose={() => setShowCalendarModal(false)}
          defaultTitle={calendarModalTitle}
          defaultDate={calendarModalDefaultDate}
          onEventCreated={() => setShowCalendarModal(false)}
          reservationFlowId={reservationFlowId}
          reservationFlowTaskId={calendarModalTask.id}
        />
      )}
    </div>
  );
};

export default StageCard;