import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Trash2, UserCircle } from 'lucide-react';

interface TaskComment {
  id: string;
  content: string;
  created_at: string;
  user: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

interface TaskCommentListProps {
  taskId: string;
  reservationFlowId: string;
  refreshTrigger?: number; // Add a refresh trigger prop
}

const TaskCommentList: React.FC<TaskCommentListProps> = ({
  taskId,
  reservationFlowId,
  refreshTrigger = 0
}) => {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchComments();
    checkAdminStatus();
  }, [taskId, reservationFlowId, refreshTrigger]); // Add refreshTrigger to dependencies

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single();

      setIsAdmin(profile?.user_type === 'Administrador');
    } catch (err) {
      console.error('Error checking admin status:', err);
    }
  };

  const fetchComments = async () => {
    try {
      setLoading(true);

      // First get the task
      const { data: flowTask, error: taskError } = await supabase
        .from('reservation_flow_tasks')
        .select('id')
        .eq('reservation_flow_id', reservationFlowId)
        .eq('task_id', taskId)
        .single();

      if (taskError && taskError.code !== 'PGRST116') throw taskError;

      if (flowTask) {
        // Get all comments for this task
        const { data: commentsData, error: commentsError } = await supabase
          .from('task_comments')
          .select(`
            id,
            content,
            created_at,
            user:profiles(
              first_name,
              last_name,
              avatar_url
            )
          `)
          .eq('reservation_flow_task_id', flowTask.id)
          .order('created_at', { ascending: false });

        if (commentsError) throw commentsError;
        setComments(commentsData || []);
      } else {
        setComments([]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Remove comment from local state
      setComments(prevComments => prevComments.filter(comment => comment.id !== commentId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Santiago'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No hay comentarios
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div key={comment.id} className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              {comment.user.avatar_url ? (
                <img
                  src={comment.user.avatar_url}
                  alt={`${comment.user.first_name} ${comment.user.last_name}`}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <UserCircle className="h-8 w-8 text-gray-400" />
              )}
              <div className="ml-2">
                <span className="font-medium text-gray-900">
                  {comment.user.first_name} {comment.user.last_name}
                </span>
                <div className="text-sm text-gray-500">
                  {formatDateTime(comment.created_at)}
                </div>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="text-red-600 hover:text-red-800"
                title="Eliminar comentario"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="text-gray-700 whitespace-pre-wrap">
            {comment.content}
          </p>
        </div>
      ))}
    </div>
  );
};

export default TaskCommentList;