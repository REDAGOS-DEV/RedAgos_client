export class BaseService {
  async request<T>(
    url: string,
    method = "GET",
    params: object = {},
  ): Promise<T> {
    const runtimeConfig = useRuntimeConfig();
    const token = import.meta.client ? localStorage.getItem("_token") : null;
    const isFormData = import.meta.client && params instanceof FormData;
 
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
 
    // Ang FormData kinahanglan mo-set og kaugalingon nga multipart boundary, so
    // dili gyud ta mo-set og Content-Type kung FormData ang gipadala.
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }
 
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
 
    const configured = runtimeConfig.public.apiBaseURL;

    // Kung walay API_BASE_URL nga gi-set, kuhaon nato ang host gikan sa browser
    // mismo — mao ni ang nagserve sa page, so sakto siya bisan unsa nga LAN IP
    // ang gamiton. Sa SSR walay `window`, so localhost ang fallback.
    const baseURL = configured || (import.meta.client
      ? `${window.location.protocol}//${window.location.hostname}:8000/api`
      : "http://127.0.0.1:8000/api");

    const config: any = {
      baseURL,
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
        data?: Record<string, any>;
      };

      requestError.status = status;
      requestError.errors = responseData?.errors;
      // Ang whole body gi-attach para ma-basa sa caller ang mga field apil sa
      // `code` ug `screening_valid_until` — dili igo ang status code lang.
      requestError.data = responseData;

 
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
