/** The API the preload script exposes to the renderer as `window.homecloud`. */
export interface HomeCloudApi {
  getAppVersion: () => Promise<string>;
}

/** IPC channel names, shared by main and preload. */
export const ipc = {
  appVersion: "app:version",
} as const;
