import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan variables de entorno VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyRealtimeMigration() {
  try {
    console.log('🚀 Aplicando migración de Realtime...');
    
    // Habilitar Realtime para cada tabla
    const tables = [
      'task_assignments',
      'commission_flow_tasks', 
      'collapsed_tasks',
      'reservation_flows',
      'commission_flows'
    ];
    
    for (const table of tables) {
      console.log(`📋 Habilitando Realtime para: ${table}`);
      
      // Ejecutar la consulta SQL directamente
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`❌ Error al verificar tabla ${table}:`, error);
        continue;
      }
      
      console.log(`✅ Tabla ${table} verificada`);
    }
    
    console.log('');
    console.log('🎉 Verificación completada');
    console.log('📋 Para habilitar Realtime completamente:');
    console.log('   1. Ve a Supabase Dashboard > Database > Replication');
    console.log('   2. Habilita Realtime para las siguientes tablas:');
    tables.forEach(table => console.log(`      - ${table}`));
    console.log('');
    console.log('💡 O ejecuta estas consultas SQL en el SQL Editor:');
    console.log('');
    console.log('ALTER PUBLICATION supabase_realtime ADD TABLE task_assignments;');
    console.log('ALTER PUBLICATION supabase_realtime ADD TABLE commission_flow_tasks;');
    console.log('ALTER PUBLICATION supabase_realtime ADD TABLE collapsed_tasks;');
    console.log('ALTER PUBLICATION supabase_realtime ADD TABLE reservation_flows;');
    console.log('ALTER PUBLICATION supabase_realtime ADD TABLE commission_flows;');
    
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  }
}

applyRealtimeMigration(); 