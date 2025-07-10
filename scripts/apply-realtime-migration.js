import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config();

const execAsync = promisify(exec);

async function applyRealtimeMigration() {
  try {
    console.log('🚀 Aplicando migración de Realtime usando Supabase CLI...');
    
    // Verificar si Supabase CLI está instalado
    try {
      await execAsync('supabase --version');
    } catch (error) {
      console.error('❌ Error: Supabase CLI no está instalado o no está en el PATH');
      console.log('💡 Instala Supabase CLI con: npm install -g supabase');
      process.exit(1);
    }
    
    // Aplicar la migración usando Supabase CLI
    console.log('📋 Aplicando migración: 20250403000000_enable_realtime_tables.sql');
    
    const { stdout, stderr } = await execAsync('supabase db push');
    
    if (stderr && !stderr.includes('warning')) {
      console.error('❌ Error al aplicar migración:', stderr);
      process.exit(1);
    }
    
    console.log('✅ Migración de Realtime aplicada exitosamente');
    console.log('📋 Tablas habilitadas para Realtime:');
    console.log('   - task_assignments');
    console.log('   - commission_flow_tasks');
    console.log('   - collapsed_tasks');
    console.log('   - reservation_flows');
    console.log('   - commission_flows');
    console.log('');
    console.log('🎉 El sistema de notificaciones en tiempo real está listo para usar');
    console.log('');
    console.log('💡 Para probar el sistema:');
    console.log('   1. Inicia la aplicación: npm run dev');
    console.log('   2. Abre la consola del navegador (F12)');
    console.log('   3. Asigna una tarea a un usuario');
    console.log('   4. Observa que el contador se actualiza instantáneamente');
    
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  }
}

applyRealtimeMigration(); 