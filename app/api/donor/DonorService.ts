import BaseService from '../BaseService';
 
class DonorService extends BaseService {
    private static instance: DonorService;
 
    public static getInstance(): DonorService {
        if (!DonorService.instance) {
            DonorService.instance = new DonorService();
        }
        return DonorService.instance;
    }
 
    private resource = '/donors';

    async register(payload: object): Promise<any> {
        return await this.request(`${this.resource}/register`, 'POST', payload);
    }

    async dashboard(): Promise<any> {
        return await this.request(`${this.resource}/dashboard`, 'GET');
    }

    async profile(): Promise<any> {
        return await this.request(`${this.resource}/profile`, 'GET');
    }

    async updateProfile(payload: object): Promise<any> {
        return await this.request(`${this.resource}/profile`, 'PATCH', payload);
    }

    async updatePassword(payload: object): Promise<any> {
        return await this.request(`${this.resource}/password`, 'POST', payload);
    }

    async updateNotificationPreferences(payload: object): Promise<any> {
        return await this.request(`${this.resource}/notification-preferences`, 'PATCH', payload);
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
 
export const donorService = DonorService.getInstance();
