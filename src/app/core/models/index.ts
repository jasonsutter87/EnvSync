export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Environment {
  id: string;
  project_id: string;
  name: string;
  env_type: 'Development' | 'Staging' | 'Production' | { Custom: string };
  created_at: string;
  updated_at: string;
}

export interface Variable {
  id: string;
  environment_id: string;
  key: string;
  value: string;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

export interface VaultStatus {
  is_initialized: boolean;
  is_unlocked: boolean;
  last_activity?: string;
}

export interface SearchResult {
  project: Project;
  environment: Environment;
  variable: Variable;
}

export function getEnvTypeLabel(envType: Environment['env_type']): string {
  if (typeof envType === 'string') {
    return envType;
  }
  return envType.Custom;
}

export function getEnvTypeClass(envType: Environment['env_type']): string {
  const type = typeof envType === 'string' ? envType.toLowerCase() : 'custom';
  return `env-${type}`;
}

// Netlify types
export interface NetlifySite {
  id: string;
  name: string;
  url: string;
  account_slug: string;
  admin_url: string;
}

export interface NetlifyEnvVar {
  key: string;
  scopes: string[];
  values: NetlifyEnvValue[];
}

export interface NetlifyEnvValue {
  value: string;
  context: string;
}
