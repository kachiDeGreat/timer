export interface ScreenLaunchResult {
  success: boolean;
  message: string;
  isExtended?: boolean;
}

/**
 * Launch the Stage / Projector view on an extended display if available,
 * or open as a dedicated popup window ready to drag to a second monitor.
 */
export async function launchProjectorWindow(): Promise<ScreenLaunchResult> {
  const projectorUrl = `${window.location.origin}${window.location.pathname}?view=projector&autoFullscreen=1`;

  // 1. Check for Window Management API (Chrome, Edge, Opera)
  if ('getScreenDetails' in window) {
    try {
      // Prompt user permission if not already granted
      const screenDetails = await (window as unknown as { getScreenDetails: () => Promise<any> }).getScreenDetails();

      if (screenDetails && screenDetails.screens && screenDetails.screens.length > 0) {
        // Find extended monitor that is not the current screen
        const externalScreen =
          screenDetails.screens.find(
            (s: any) => s.isExtended && s !== screenDetails.currentScreen
          ) || screenDetails.screens.find((s: any) => s !== screenDetails.currentScreen) || screenDetails.screens[0];

        const left = externalScreen.availLeft ?? externalScreen.left ?? 0;
        const top = externalScreen.availTop ?? externalScreen.top ?? 0;
        const width = externalScreen.availWidth ?? externalScreen.width ?? 1280;
        const height = externalScreen.availHeight ?? externalScreen.height ?? 720;

        const win = window.open(
          projectorUrl,
          'StageTimerProjectorOutput',
          `left=${left},top=${top},width=${width},height=${height},popup=yes,menubar=no,toolbar=no,location=no,status=no`
        );

        if (win) {
          const isExtendedScreen = externalScreen.isExtended && externalScreen !== screenDetails.currentScreen;
          return {
            success: true,
            message: isExtendedScreen
              ? 'Launched directly on extended display (TV/Projector)!'
              : 'Launched projector window. You can drag it to your external display.',
            isExtended: isExtendedScreen,
          };
        }
      }
    } catch (err) {
      console.warn('Window Management API error or dismissed:', err);
    }
  }

  // 2. Standard popup window fallback
  const fallbackWin = window.open(
    projectorUrl,
    'StageTimerProjectorOutput',
    'popup=yes,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
  );

  if (fallbackWin) {
    return {
      success: true,
      message: 'Projector window opened. Drag it to your TV / Projector and press F11 or Fullscreen!',
      isExtended: false,
    };
  }

  // 3. Fallback to normal tab if popup was blocked
  window.open(projectorUrl, '_blank');
  return {
    success: true,
    message: 'Opened in a new browser tab. Please allow popups for automatic window placement.',
    isExtended: false,
  };
}

/**
 * Toggle fullscreen mode on the document or element
 */
export async function toggleFullScreen(element: HTMLElement = document.documentElement): Promise<boolean> {
  try {
    if (!document.fullscreenElement) {
      await element.requestFullscreen();
      return true;
    } else {
      await document.exitFullscreen();
      return false;
    }
  } catch (err) {
    console.warn('Fullscreen request failed:', err);
    return false;
  }
}
