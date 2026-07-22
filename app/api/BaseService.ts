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
      const responseData = error?.response?._data || error?.data || {};
      const message =
        responseData?.message ||
        error?.message;
      const requestError = new Error(message || "Something went wrong. Please try again.") as Error & {
        status?: number;
        errors?: Record<string, string[]>;
      };

      requestError.status = status;
      requestError.errors = responseData?.errors;
 
      switch (status) {
        case 400:
        case 401:
        case 404:
        case 422:
        case 429:
          throw requestError;
        case 500:
          requestError.message = message || "Server error. Please try again or contact the administrator.";
          throw requestError;
        default:
          throw requestError;
      }
    }
  }
}
 
export default BaseService;
