-- Habilitar Realtime para las tablas necesarias para el sistema de notificaciones en tiempo real

-- Habilitar Realtime para task_assignments
ALTER PUBLICATION supabase_realtime ADD TABLE task_assignments;

-- Habilitar Realtime para commission_flow_tasks
ALTER PUBLICATION supabase_realtime ADD TABLE commission_flow_tasks;

-- Habilitar Realtime para collapsed_tasks
ALTER PUBLICATION supabase_realtime ADD TABLE collapsed_tasks;

-- Habilitar Realtime para reservation_flows
ALTER PUBLICATION supabase_realtime ADD TABLE reservation_flows;

-- Habilitar Realtime para commission_flows
ALTER PUBLICATION supabase_realtime ADD TABLE commission_flows;

-- Comentario explicativo
COMMENT ON TABLE task_assignments IS 'Tabla con Realtime habilitado para notificaciones en tiempo real del contador de tareas';
COMMENT ON TABLE commission_flow_tasks IS 'Tabla con Realtime habilitado para notificaciones en tiempo real del contador de tareas';
COMMENT ON TABLE collapsed_tasks IS 'Tabla con Realtime habilitado para notificaciones en tiempo real del contador de tareas';
COMMENT ON TABLE reservation_flows IS 'Tabla con Realtime habilitado para notificaciones en tiempo real del contador de tareas';
COMMENT ON TABLE commission_flows IS 'Tabla con Realtime habilitado para notificaciones en tiempo real del contador de tareas'; 