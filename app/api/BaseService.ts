import { reportUnauthorized } from "./unauthorized";

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

      // Ang message sa server ra ang ipakita. Ang `error.message` gikan sa
      // ofetch kay morag `[GET] "http://host/api/x": 500 Internal Server Error`
      // — nagbutyag sa API URL ug walay pulos sa user. Kaniadto ni gigamit isip
      // fallback, mao nga ang friendly nga 500 nga teksto sa ubos wala gyud
      // makagamit: kanunay tinuod ang `message`, so laktawan ang `||`.
      const message = responseData?.message;
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

 
      // Ang 401 nagpasabot nga gisalikway na ang token — expired, gi-revoke, o
      // nag-sign out sa laing device. Ang session-expiry plugin mao ang mo-decide
      // asa dad-on ang user; dinhi, i-report ra. Mo-throw gihapon ta pagkahuman,
      // so walay mausab sa mga caller nga naa nay kaugalingong catch.
      if (status === 401) {
        reportUnauthorized(requestError);
      }

      if (status === 500) {
        requestError.message = message || "Server error. Please try again or contact the administrator.";
      }

      // Gitipigan ang tinuod nga transport error para sa dev diagnostics, apan
      // dili ni makita sa user.
      if (import.meta.dev && error?.message) {
        requestError.cause = error;
      }

      throw requestError;
    }
  }

  /**
   * Fetch a binary response with the caller's bearer token.
   *
   * request() always asks for JSON and hands back parsed data, so it cannot
   * carry an image. Identity documents are served from an authenticated route
   * rather than a signed link, which means the browser cannot fetch them
   * through a plain <img src> - the page has to make the request itself and
   * render the blob.
   */
  async requestBlob(url: string): Promise<Blob> {
    const runtimeConfig = useRuntimeConfig();
    const token = import.meta.client ? localStorage.getItem("_token") : null;

    const headers: Record<string, string> = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const configured = runtimeConfig.public.apiBaseURL;
    const baseURL = configured || (import.meta.client
      ? `${window.location.protocol}//${window.location.hostname}:8000/api`
      : "http://127.0.0.1:8000/api");

    try {
      return await $fetch<Blob>(url, {
        baseURL,
        method: "GET",
        headers,
        responseType: "blob",
      });
    } catch (error: any) {
      const status = error?.response?.status;
      const requestError = new Error(
        status === 403
          ? "You are not allowed to view this document."
          : "Could not load the document. Please try again."
      ) as Error & { status?: number };

      requestError.status = status;

      // Parehas ra sa request(): ang blob route nagdala sa samang token, so ang
      // 401 dinhi pareho gihapon nga patay na nga session.
      if (status === 401) {
        reportUnauthorized(requestError);
      }

      throw requestError;
    }
  }
}
 
export default BaseService;
