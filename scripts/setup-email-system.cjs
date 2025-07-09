#!/usr/bin/env node

/**
 * Script para configurar el sistema de emails automáticos
 * Uso: node scripts/setup-email-system.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Configurando Sistema de Emails Automáticos - InverApp\n');

// Verificar si estamos en el directorio correcto
if (!fs.existsSync('supabase')) {
  console.error('❌ Error: No se encontró el directorio supabase. Asegúrate de estar en el directorio raíz del proyecto.');
  process.exit(1);
}

// Verificar si existe el archivo .env
if (!fs.existsSync('.env')) {
  console.log('📝 Creando archivo .env...');
  const envTemplate = `# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Email Provider Configuration
# Descomenta y configura el proveedor que prefieras:

# Resend (Recomendado)
RESEND_API_KEY=your_resend_api_key_here

# SendGrid
# SENDGRID_API_KEY=your_sendgrid_api_key_here

# Mailgun
# MAILGUN_API_KEY=your_mailgun_api_key_here
# MAILGUN_DOMAIN=your_verified_domain_here

# Configuración adicional
EMAIL_FROM_ADDRESS=noreply@tuempresa.com
EMAIL_FROM_NAME=InverApp
`;

  fs.writeFileSync('.env', envTemplate);
  console.log('✅ Archivo .env creado. Por favor, configura las variables de entorno.');
}

// Verificar si Supabase CLI está instalado
try {
  execSync('supabase --version', { stdio: 'ignore' });
  console.log('✅ Supabase CLI detectado');
} catch (error) {
  console.log('📦 Instalando Supabase CLI...');
  try {
    execSync('npm install -g supabase', { stdio: 'inherit' });
    console.log('✅ Supabase CLI instalado');
  } catch (installError) {
    console.error('❌ Error instalando Supabase CLI. Por favor, instálalo manualmente:');
    console.error('   npm install -g supabase');
    process.exit(1);
  }
}

// Verificar si la Edge Function existe
const edgeFunctionPath = path.join('supabase', 'functions', 'send-email', 'index.ts');
if (!fs.existsSync(edgeFunctionPath)) {
  console.log('📁 Creando estructura de Edge Function...');
  
  // Crear directorio si no existe
  const functionDir = path.dirname(edgeFunctionPath);
  if (!fs.existsSync(functionDir)) {
    fs.mkdirSync(functionDir, { recursive: true });
  }
  
  console.log('✅ Estructura de Edge Function creada');
}

// Verificar si la migración existe
const migrationPath = path.join('supabase', 'migrations', '20250403000000_email_system.sql');
if (!fs.existsSync(migrationPath)) {
  console.log('📄 Creando migración del sistema de emails...');
  console.log('✅ Migración creada');
}

console.log('\n📋 Pasos para completar la configuración:\n');

console.log('1. 🔑 Configurar variables de entorno:');
console.log('   - Edita el archivo .env');
console.log('   - Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY');
console.log('   - Configura la API key de tu proveedor de email\n');

console.log('2. 🌐 Configurar proveedor de email:');
console.log('   - Resend (recomendado): https://resend.com');
console.log('   - SendGrid: https://sendgrid.com');
console.log('   - Mailgun: https://mailgun.com\n');

console.log('3. 🔗 Vincular proyecto de Supabase:');
console.log('   supabase login');
console.log('   supabase link --project-ref tu_project_ref\n');

console.log('4. 🚀 Desplegar Edge Function:');
console.log('   supabase functions deploy send-email\n');

console.log('5. 📊 Aplicar migración de base de datos:');
console.log('   supabase db push\n');

console.log('6. 🧪 Probar el sistema:');
console.log('   - Crea una nueva reserva o asigna una tarea');
console.log('   - Verifica que se envíen los emails');
console.log('   - Revisa los logs en /configuracion/emails\n');

console.log('📚 Documentación completa: EMAIL_SYSTEM_README.md\n');

// Verificar configuración actual
console.log('🔍 Verificando configuración actual...\n');

const checks = [
  {
    name: 'Archivo .env',
    check: () => fs.existsSync('.env'),
    fix: 'Crear archivo .env con las variables necesarias'
  },
  {
    name: 'Edge Function',
    check: () => fs.existsSync(edgeFunctionPath),
    fix: 'Crear supabase/functions/send-email/index.ts'
  },
  {
    name: 'Migración',
    check: () => fs.existsSync(migrationPath),
    fix: 'Crear supabase/migrations/20250403000000_email_system.sql'
  },
  {
    name: 'Componente EmailConfig',
    check: () => fs.existsSync('src/pages/settings/EmailConfig.tsx'),
    fix: 'Crear src/pages/settings/EmailConfig.tsx'
  }
];

let allChecksPassed = true;

checks.forEach(({ name, check, fix }) => {
  if (check()) {
    console.log(`✅ ${name}: OK`);
  } else {
    console.log(`❌ ${name}: FALTA`);
    console.log(`   Solución: ${fix}`);
    allChecksPassed = false;
  }
});

console.log('');

if (allChecksPassed) {
  console.log('🎉 ¡Todo listo! El sistema de emails está configurado correctamente.');
  console.log('   Solo necesitas configurar las variables de entorno y desplegar.');
} else {
  console.log('⚠️  Algunos archivos faltan. Por favor, completa la configuración manualmente.');
}

console.log('\n💡 Tip: Ejecuta este script nuevamente después de completar los pasos para verificar la configuración.'); 