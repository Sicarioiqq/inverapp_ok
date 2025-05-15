import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually to get environment variables
function loadEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        envVars[key] = value;
      }
    });
    
    return envVars;
  } catch (err) {
    console.error('Error loading .env file:', err.message);
    return {};
  }
}

// Load environment variables from .env file
const envVars = loadEnvFile();

// Get Supabase credentials from environment variables
const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL and key are required.');
  console.error('Make sure your .env file contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

console.log('Using Supabase URL:', supabaseUrl);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Get the migration file path from command line arguments
const migrationPath = process.argv[2];

if (!migrationPath) {
  console.error('Error: Migration file path is required.');
  console.error('Usage: npm run apply-migration -- ./path/to/migration.sql');
  process.exit(1);
}

// Check if the migration file exists
if (!fs.existsSync(migrationPath)) {
  console.error(`Error: Migration file not found at path: ${migrationPath}`);
  console.error('Please check that the file exists and the path is correct.');
  process.exit(1);
}

// Read the migration file
try {
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Applying migration from ${migrationPath}...`);

  // Apply the migration using Supabase's SQL query
  applyMigration(migrationSql);
} catch (err) {
  console.error(`Error reading migration file: ${err.message}`);
  process.exit(1);
}

// Function to apply the migration
async function applyMigration(sql) {
  try {
    // Execute the SQL directly using Supabase's query method
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error applying migration:', error);
      process.exit(1);
    }
    
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}