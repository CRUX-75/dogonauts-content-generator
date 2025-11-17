import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

console.log('🔍 Checking configuration...\n');

const checks = [
  { name: 'SUPABASE_URL', value: process.env.SUPABASE_URL, required: true },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY, required: true },
  { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY, required: true },
  { name: 'PORT', value: process.env.PORT, required: false },
  { name: 'NODE_ENV', value: process.env.NODE_ENV, required: false },
];

let hasErrors = false;

checks.forEach(check => {
  const exists = !!check.value;
  const status = exists ? '✅' : (check.required ? '❌' : '⚠️');
  const displayValue = check.value 
    ? (check.value.length > 20 ? `${check.value.substring(0, 20)}...` : check.value)
    : 'NOT SET';
  
  console.log(`${status} ${check.name}: ${displayValue}`);
  
  if (check.required && !exists) {
    hasErrors = true;
  }
});

console.log('\n' + (hasErrors ? '❌ Configuration incomplete!' : '✅ Configuration looks good!'));

if (hasErrors) {
  console.log('\nℹ️  Please check your .env file and make sure all required variables are set.');
  process.exit(1);
}