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
