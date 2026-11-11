export interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isPrimary?: boolean;
}

export interface DisplaysPayload {
  displays: DisplayInfo[];
  hasExternal: boolean;
  externalDisplay: DisplayInfo | null;
  isProjectorOpen: boolean;
}

export interface RemoteServerInfo {
  active: boolean;
  port: number;
  primaryIp: string;
  primaryUrl: string;
  ipAddresses: Array<{ iface: string; ip: string; url: string }>;
  clientsCount: number;
}

export interface ElectronAPI {
  isElectron: boolean;
  openProjector: () => Promise<{ success: boolean }>;
  closeProjector: () => Promise<{ success: boolean }>;
  toggleProjectorFullscreen: () => Promise<boolean>;
  getDisplays: () => Promise<DisplaysPayload>;
  onDisplayChange: (callback: (payload: DisplaysPayload) => void) => () => void;
  onProjectorStateChange: (callback: (isOpen: boolean) => void) => () => void;
  sendState?: (state: any) => void;
  onStateUpdate?: (callback: (state: any) => void) => () => void;
  sendTick?: (remainingSeconds: number) => void;
  onTick?: (callback: (remainingSeconds: number) => void) => () => void;
  getRemoteInfo?: () => Promise<RemoteServerInfo>;
  onRemoteAction?: (callback: (action: any) => void) => () => void;
  onRemoteClientsChange?: (callback: (count: number) => void) => () => void;
  getSettings?: () => Promise<any>;
  saveSettings?: (settings: any) => Promise<any>;
  getQueue?: () => Promise<any>;
  saveQueue?: (queue: any) => Promise<any>;
  exportQueueDialog?: (queueData: any) => Promise<{ success?: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  importQueueDialog?: () => Promise<{ success?: boolean; queue?: any[]; filePath?: string; canceled?: boolean; error?: string }>;
  saveTimingReportEntry?: (entry: any) => Promise<{ success?: boolean; error?: string }>;
  getTodayTimingReport?: () => Promise<any[]>;
  clearTimingReports?: () => Promise<{ success?: boolean; error?: string }>;
  openTimingReportsFolder?: () => Promise<{ success?: boolean; folder?: string; error?: string }>;
}


declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
