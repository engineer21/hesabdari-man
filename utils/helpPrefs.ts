import { apiJson } from './api';

export type HelpConfig = {
  showHelpOnLogin: boolean;
  seenPages: string[];
};

const defaults: HelpConfig = {
  showHelpOnLogin: false,
  seenPages: [],
};

/** Public — used on login screen before auth */
export async function fetchPublicHelpConfig(): Promise<Pick<HelpConfig, 'showHelpOnLogin'>> {
  try {
    const data = await apiJson<{ showHelpOnLogin?: boolean }>('/api/help/config', 'GET');
    return { showHelpOnLogin: data.showHelpOnLogin === true };
  } catch {
    return { showHelpOnLogin: false };
  }
}

export async function fetchHelpConfig(): Promise<HelpConfig> {
  try {
    const data = await apiJson<Partial<HelpConfig>>('/api/help/config', 'GET');
    return {
      showHelpOnLogin: data.showHelpOnLogin === true,
      seenPages: Array.isArray(data.seenPages) ? data.seenPages.map(String) : [],
    };
  } catch {
    return { ...defaults };
  }
}

export async function saveHelpConfig(patch: Partial<HelpConfig>): Promise<HelpConfig> {
  return apiJson<HelpConfig>('/api/help/config', 'PUT', patch);
}

export async function markPageHelpSeen(pageId: string, current: string[]): Promise<string[]> {
  if (current.includes(pageId)) return current;
  const seenPages = [...current, pageId];
  try {
    const next = await saveHelpConfig({ seenPages });
    return next.seenPages || seenPages;
  } catch {
    return seenPages;
  }
}

export function isPageHelpNew(pageId: string, seenPages: string[]): boolean {
  return !seenPages.includes(pageId);
}
