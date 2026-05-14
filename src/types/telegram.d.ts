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
      };
    };
  }
}
