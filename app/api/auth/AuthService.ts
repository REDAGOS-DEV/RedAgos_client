import BaseService from '../BaseService';
 
class AuthService extends BaseService {
    private static instance: AuthService;
 
    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }
 
    private resource = '/auths';

    /**
     * `login` takes an email address, a donor code or a username; `email` is
     * the older field the server still accepts.
     */
    async login(payload: { login?: string; email?: string; password: string; role?: string }): Promise<any> {
        return await this.request('/login', 'POST', payload);
    }

    /** Sign in with the ID token Google Identity Services gave the browser. */
    async loginWithGoogle(credential: string): Promise<any> {
        return await this.request('/login/google', 'POST', { credential });
    }

    async forgotPassword(payload: { email: string }): Promise<any> {
        return await this.request('/forgot-password', 'POST', payload);
    }

    /**
     * Set a new password from the emailed reset link. `token` and `email` come
     * from the link's query string (see ResetPasswordNotification on the
     * server); the server revokes every existing session on success.
     */
    async resetPassword(payload: {
        token: string;
        email: string;
        password: string;
        password_confirmation: string;
    }): Promise<any> {
        return await this.request('/reset-password', 'POST', payload);
    }

    async logout(): Promise<any> {
        return await this.request('/logout', 'POST');
    }

    async logoutFromAllDevices(): Promise<any> {
        return await this.request('/logout-all', 'POST');
    }

    /**
     * The address and the six-digit code mailed to it (2026-11-03; it was a
     * signed link before). A wrong, expired or used-up code is a 422 on `code`.
     */
    async verifyEmail(email: string, code: string): Promise<any> {
        return await this.request('/email/verify', 'POST', { email, code });
    }

    async resendVerificationEmail(): Promise<any> {
        return await this.request('/email/verification-notification', 'POST');
    }

    /**
     * Ang endpoint sa ibabaw kay naa sa likod sa `auth:sanctum`, ug ang login
     * gi-refuse na hangtod ma-verify ang email — so ang bag-ong rehistro walay
     * token nga magamit. Kini nga guest variant ang ilang agianan: email ra ang
     * gikinahanglan, ug pareho ra gyud ang tubag bisan unsa pa ang address, so
     * dili siya magamit pang-usisa kung kinsa ang naka-rehistro.
     */
    async resendVerificationEmailFor(email: string): Promise<any> {
        return await this.request('/email/resend-verification', 'POST', { email });
    }
 
    async list(params: object = {}): Promise<any> {
        return await this.request(this.resource, 'GET', params);
    }
 
    async create(payload: object): Promise<any> {
        return await this.request(this.resource, 'POST', payload);
    }
 
    async show(uuid: string): Promise<any> {
        return await this.request(`${this.resource}/${uuid}`, 'GET');
    }
 
    async update(uuid: string, payload: object): Promise<any> {
        return await this.request(`${this.resource}/${uuid}`, 'PUT', payload);
    }
 
    async delete(uuid: string): Promise<any> {
        return await this.request(`${this.resource}/${uuid}`, 'DELETE');
    }
 
    async restore(uuid: string): Promise<any> {
        return await this.request(`${this.resource}/${uuid}/restore`, 'POST');
    }
}
 
export const authService = AuthService.getInstance();
