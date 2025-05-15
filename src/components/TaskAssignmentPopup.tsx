import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { usePopup } from '../contexts/PopupContext';
import { Loader2, Search, UserCircle } from 'lucide-react';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  email: string;
  avatar_url?: string;
}

interface TaskAssignmentPopupProps {
  taskId: string;
  reservationFlowId?: string;
  currentAssignees: string[];
  onSave: () => void;
  onClose: () => void;
}

const TaskAssignmentPopup: React.FC<TaskAssignmentPopupProps> = ({
  taskId,
  reservationFlowId,
  currentAssignees,
  onSave,
  onClose
}) => {
  const { session } = useAuthStore();
  const { hidePopup } = usePopup();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(currentAssignees);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const query = supabase
        .from('profiles')
        .select('id, first_name, last_name, position, email, avatar_url');

      if (searchTerm) {
        query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    try {
      if (!session?.user.id) {
        throw new Error('No se ha podido identificar al usuario');
      }

      setSubmitting(true);
      setError(null);

      if (reservationFlowId) {
        // Handle regular task assignments for reservation flow
        // First, get or create the task
        const { data: flowTask, error: flowTaskError } = await supabase
          .from('reservation_flow_tasks')
          .select('id')
          .eq('reservation_flow_id', reservationFlowId)
          .eq('task_id', taskId)
          .maybeSingle();

        if (flowTaskError) throw flowTaskError;

        let taskRecord;
        if (!flowTask) {
          const { data: newTask, error: createError } = await supabase
            .from('reservation_flow_tasks')
            .insert({
              reservation_flow_id: reservationFlowId,
              task_id: taskId,
              status: 'pending'
            })
            .select()
            .single();

          if (createError) throw createError;
          taskRecord = newTask;
        } else {
          taskRecord = flowTask;
        }

        // Get current assignments
        const { data: currentAssignments, error: assignmentsError } = await supabase
          .from('task_assignments')
          .select('user_id')
          .eq('reservation_flow_id', reservationFlowId)
          .eq('task_id', taskId);

        if (assignmentsError) throw assignmentsError;

        const currentUserIds = new Set(currentAssignments?.map(a => a.user_id) || []);
        const selectedUserIds = new Set(selectedUsers);

        // Users to remove
        const usersToRemove = [...currentUserIds].filter(id => !selectedUserIds.has(id));

        // Users to add
        const usersToAdd = [...selectedUserIds].filter(id => !currentUserIds.has(id));

        // Remove unwanted assignments
        if (usersToRemove.length > 0) {
          const { error: deleteError } = await supabase
            .from('task_assignments')
            .delete()
            .eq('reservation_flow_id', reservationFlowId)
            .eq('task_id', taskId)
            .in('user_id', usersToRemove);

          if (deleteError) throw deleteError;
        }

        // Add new assignments
        if (usersToAdd.length > 0) {
          const newAssignments = usersToAdd.map(userId => ({
            reservation_flow_id: reservationFlowId,
            task_id: taskId,
            user_id: userId,
            assigned_by: session.user.id
          }));

          const { error: insertError } = await supabase
            .from('task_assignments')
            .insert(newAssignments);

          if (insertError) throw insertError;
        }
        
        // Update the assignee_id in reservation_flow_tasks
        // If there's exactly one user selected, set them as the assignee
        // If there are multiple or none, set assignee_id to null
        const assigneeId = selectedUsers.length === 1 ? selectedUsers[0] : null;
        
        const { error: updateError } = await supabase
          .from('reservation_flow_tasks')
          .update({ assignee_id: assigneeId })
          .eq('id', taskRecord.id);
          
        if (updateError) throw updateError;
      } else {
        // Handle default task assignments
        // First remove all existing assignments
        const { error: deleteError } = await supabase
          .from('default_task_assignments')
          .delete()
          .eq('task_id', taskId);

        if (deleteError) throw deleteError;

        // Then add new assignments
        if (selectedUsers.length > 0) {
          const newAssignments = selectedUsers.map(userId => ({
            task_id: taskId,
            user_id: userId,
            created_by: session.user.id,
            updated_by: session.user.id
          }));

          const { error: insertError } = await supabase
            .from('default_task_assignments')
            .insert(newAssignments);

          if (insertError) throw insertError;
        }
      }

      onSave();
      hidePopup();
    } catch (err: any) {
      console.error('Error in handleSubmit:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar usuarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <label
                key={user.id}
                className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(user.id)}
                  onChange={() => handleUserToggle(user.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex items-center ml-3 flex-1">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {user.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt={`${user.first_name} ${user.last_name}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircle className="h-6 w-6 text-gray-500" />
                    )}
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {user.position}
                    </div>
                    <div className="text-sm text-gray-500">
                      {user.email}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
              Guardando...
            </>
          ) : (
            'Guardar'
          )}
        </button>
      </div>
    </div>
  );
};

export default TaskAssignmentPopup;