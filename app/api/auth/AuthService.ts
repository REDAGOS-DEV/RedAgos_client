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

    async login(payload: { email: string; password: string }): Promise<any> {
        return await this.request('/login', 'POST', payload);
    }

    async forgotPassword(payload: { email: string }): Promise<any> {
        return await this.request('/forgot-password', 'POST', payload);
    }

    async logout(): Promise<any> {
        return await this.request('/logout', 'POST');
    }

    async logoutFromAllDevices(): Promise<any> {
        return await this.request('/logout-all', 'POST');
    }

    /**
     * Ang query string kay gi-forward nga verbatim: gi-validate sa Laravel ang
     * signature batok sa raw, order-sensitive nga query string. Kung i-rebuild
     * nato ang params isip object, mausab ang order ug mapakyas ang signature.
     */
    async verifyEmail(rawQuery: string): Promise<any> {
        return await this.request(`/email/verify?${rawQuery}`, 'POST');
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
