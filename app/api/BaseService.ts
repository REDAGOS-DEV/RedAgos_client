export class BaseService {
  async request<T>(
    url: string,
    method = "GET",
    params: object = {},
  ): Promise<T> {
    const runtimeConfig = useRuntimeConfig();
    const token = import.meta.client ? localStorage.getItem("_token") : null;
 
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
 
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
 
    const config: any = {
      baseURL: runtimeConfig.public.apiBaseURL,
      method,
      headers,
    };
 
    if (method.toUpperCase() === "GET") {
      config.params = params;
    } else {
      config.body = params;
    }
 
    try {
      return await $fetch<T>(url, config);
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        error?.response?._data?.message ||
        error?.data?.message ||
        error?.message;
 
      switch (status) {
        case 400:
        case 401:
        case 404:
        case 422:
        case 429:
          throw new Error(message || "Validation or Request Error");
        case 500:
          throw new Error(
            message || "Server error. Please try again or contact the administrator.",
          );
        default:
          throw new Error(message || "Something went wrong. Please try again.");
      }
    }
  }
}
 
export default BaseService;
