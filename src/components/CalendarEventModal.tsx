import React, { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { supabase } from '../lib/supabase';
import { UserPlus, Trash2 } from 'lucide-react';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

interface CalendarEventModalProps {
  open: boolean;
  onClose: () => void;
  defaultTitle: string;
  defaultDate: string;
  defaultDescription?: string;
  defaultLocation?: string;
  onEventCreated?: () => void;
  reservationFlowId?: string;
  reservationFlowTaskId?: string;
}

const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  open,
  onClose,
  defaultTitle,
  defaultDate,
  defaultDescription = '',
  defaultLocation = '',
  onEventCreated,
  reservationFlowId,
  reservationFlowTaskId
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [date, setDate] = useState(defaultDate);
  const [description, setDescription] = useState(defaultDescription);
  const [location, setLocation] = useState(defaultLocation);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitle(defaultTitle);
    setDate(defaultDate);
    setDescription(defaultDescription);
    setLocation(defaultLocation);
    setSelectedUsers([]);
  }, [open, defaultTitle, defaultDate, defaultDescription, defaultLocation]);

  useEffect(() => {
    if (showUserModal && allUsers.length === 0) {
      fetchUsers();
    }
    // eslint-disable-next-line
  }, [showUserModal]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url');
    if (!error && data) {
      setAllUsers(data);
    }
  };

  const handleUserSelect = (user: User) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleUserRemove = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleSave = async () => {
    if (!title || !date || selectedUsers.length === 0) return;
    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Usuario no autenticado');
      // Crear un evento por cada usuario seleccionado
      for (const user of selectedUsers) {
        const { error } = await supabase
          .from('calendar_events')
          .insert({
            title,
            description,
            location,
            type: 'gestion',
            start: date,
            created_by: currentUser.id,
            assigned_to: user.id,
            reservation_flow_id: reservationFlowId || null,
            reservation_flow_task_id: reservationFlowTaskId || null
          });
        if (error) throw error;
      }
      if (onEventCreated) onEventCreated();
      onClose();
    } catch (error) {
      alert('Error al crear la gestión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-30"></div>
        <Dialog.Panel className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-4 text-sm">
          <Dialog.Title className="text-xl font-bold mb-4">Agendar Gestión</Dialog.Title>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Título de la gestión"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuarios responsables *</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedUsers.map(user => (
                  <span key={user.id} className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    {user.first_name} {user.last_name}
                    <button onClick={() => handleUserRemove(user.id)} className="ml-1 text-red-500 hover:text-red-700">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setShowUserModal(true)}
                  className="flex items-center px-2 py-1 bg-blue-600 text-white rounded-full text-xs hover:bg-blue-700"
                >
                  <UserPlus className="h-4 w-4 mr-1" />Agregar usuario
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                rows={2}
                placeholder="Descripción de la gestión"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Ubicación"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-3 py-1 text-gray-600 hover:text-gray-800 transition-colors text-sm"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!title || !date || selectedUsers.length === 0 || loading}
              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Agendar
            </button>
          </div>
          {/* Modal de selección de usuarios */}
          <Dialog open={showUserModal} onClose={() => setShowUserModal(false)} className="fixed z-50 inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div className="fixed inset-0 bg-black opacity-30"></div>
              <Dialog.Panel className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
                <Dialog.Title className="text-lg font-bold mb-4">Seleccionar usuarios</Dialog.Title>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => { handleUserSelect(user); setShowUserModal(false); }}
                      className="flex items-center w-full px-3 py-2 hover:bg-blue-50 rounded"
                    >
                      {user.avatar_url && (
                        <img src={user.avatar_url} alt={user.first_name} className="h-6 w-6 rounded-full mr-2" />
                      )}
                      <span>{user.first_name} {user.last_name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </Dialog.Panel>
            </div>
          </Dialog>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default CalendarEventModal; 