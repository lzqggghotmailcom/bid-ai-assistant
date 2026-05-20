export interface User {
  id: string;
  email: string;
  company_name: string;
  plan: string;
  projects_remaining: number;
  free_trial_used: boolean;
}

export function isAuthenticated(): boolean {
  return document.cookie.includes('auth_token=');
}
