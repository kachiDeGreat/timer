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
}


declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
