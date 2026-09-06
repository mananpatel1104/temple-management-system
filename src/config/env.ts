/**
 * Central, validated access point for environment variables.
 *
 * Nothing in the app should read `import.meta.env` directly outside this
 * file — this keeps all required-variable validation and typing in one
 * place, per BUDGET/₹0-config and SEC principles of not leaking raw env
 * access across the codebase.
 */

function requireEnvVar(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        'Copy .env.example to .env and provide a value.',
    );
  }
  return value;
}

export const env = {
  supabaseUrl: requireEnvVar('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireEnvVar('VITE_SUPABASE_ANON_KEY'),
  appName: import.meta.env.VITE_APP_NAME || 'Shree Swaminarayan Mandir',
  appEnv: import.meta.env.VITE_APP_ENV || 'development',
  basePath: import.meta.env.VITE_BASE_PATH || '/',
} as const;

export const isProduction = env.appEnv === 'production';
export const isDevelopment = env.appEnv === 'development';
