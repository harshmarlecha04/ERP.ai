// App-wide company info, hydrated once from company_settings (see useCompanySettings).
// PDF generators and other non-React code read from here so every document
// shows the tenant's real details instead of a hardcoded placeholder.

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  logoUrl: string | null;
}

let current: CompanyInfo = {
  name: 'ERP.ai',
  address: '',
  phone: '',
  logoUrl: null,
};

export function setCompanyInfo(info: Partial<CompanyInfo>) {
  current = { ...current, ...Object.fromEntries(Object.entries(info).filter(([, v]) => v != null)) } as CompanyInfo;
}

export function getCompanyInfo(): CompanyInfo {
  return current;
}
