import { contextBridge, ipcRenderer } from "electron";
import { ipc, type HomeCloudApi } from "../shared/api.ts";

const api: HomeCloudApi = {
  getAppVersion: () => ipcRenderer.invoke(ipc.appVersion) as Promise<string>,
};

contextBridge.exposeInMainWorld("homecloud", api);
