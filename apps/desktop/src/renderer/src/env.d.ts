import type { HomeCloudApi } from "../../shared/api";

declare global {
  interface Window {
    homecloud: HomeCloudApi;
  }
}
