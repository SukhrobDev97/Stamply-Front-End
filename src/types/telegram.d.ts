export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        showScanQrPopup?: (
          params?: { text?: string },
          callback?: (data: string) => boolean,
        ) => void;
        initData: string;
        initDataUnsafe: Record<string, unknown>;
        platform?: string;
        openTelegramLink?: (url: string) => void;
        showAlert?: (message: string, callback?: () => void) => void;
        showPopup?: (
          params: { title?: string; message: string; buttons?: { id?: string; type?: string; text: string }[] },
          callback?: (buttonId: string) => void,
        ) => void;
        onEvent?: (event: string, handler: () => void) => void;
        offEvent?: (event: string, handler: () => void) => void;
      };
    };
  }
}
