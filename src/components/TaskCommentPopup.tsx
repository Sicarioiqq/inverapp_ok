import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { usePopup } from '../contexts/PopupContext';
import { Loader2 } from 'lucide-react';

interface TaskCommentPopupProps {
  taskId: string;
  reservationFlowId: string;
  onSave: () => void;
  onClose: () => void;
}

const TaskCommentPopup: React.FC<TaskCommentPopupProps> = ({
  taskId,
  reservationFlowId,
  onSave,
  onClose
}) => {
  const { session } = useAuthStore();
  const { hidePopup } = usePopup();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      // First, get or create the reservation flow task
      const { data: existingTask, error: findError } = await supabase
        .from('reservation_flow_tasks')
        .select('id')
        .eq('reservation_flow_id', reservationFlowId)
        .eq('task_id', taskId)
        .maybeSingle();

      if (findError) throw findError;

      let flowTaskId: string;

      if (existingTask) {
        flowTaskId = existingTask.id;
      } else {
        // Create new task if it doesn't exist
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
        if (!newTask) throw new Error('Failed to create task');

        flowTaskId = newTask.id;
      }

      // Now add the comment
      const { error: commentError } = await supabase
        .from('task_comments')
        .insert({
          reservation_flow_task_id: flowTaskId,
          user_id: session?.user.id,
          content: content,
          mentioned_users: []
        });

      if (commentError) throw commentError;

      // Call onSave to refresh the comments list
      onSave();
      
      // Close the popup
      hidePopup();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">
          Comentario *
        </label>
        <textarea
          id="content"
          required
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
              Guardando...
            </>
          ) : (
            'Guardar'
          )}
        </button>
      </div>
    </form>
  );
};

export default TaskCommentPopup;