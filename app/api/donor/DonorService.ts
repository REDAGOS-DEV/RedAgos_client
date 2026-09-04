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

    async eligibilityQuestions(): Promise<any> {
        return await this.request(`${this.resource}/eligibility/questions`, 'GET');
    }

    async eligibilityPrefill(): Promise<any> {
        return await this.request(`${this.resource}/eligibility/prefill`, 'GET');
    }

    async eligibilityStatus(): Promise<any> {
        return await this.request(`${this.resource}/eligibility`, 'GET');
    }

    async submitEligibilityScreening(payload: object): Promise<any> {
        return await this.request(`${this.resource}/eligibility/screening`, 'POST', payload);
    }

    async qrCode(): Promise<any> {
        return await this.request(`${this.resource}/qr-code`, 'GET');
    }

    async refreshQrCode(): Promise<any> {
        return await this.request(`${this.resource}/qr-code/refresh`, 'POST');
    }

    async appointments(): Promise<any> {
        return await this.request(`${this.resource}/appointments`, 'GET');
    }

    async bookAppointment(payload: object): Promise<any> {
        return await this.request(`${this.resource}/appointments`, 'POST', payload);
    }

    async rescheduleAppointment(id: number, payload: object): Promise<any> {
        return await this.request(`${this.resource}/appointments/${id}`, 'PATCH', payload);
    }

    async cancelAppointment(id: number): Promise<any> {
        return await this.request(`${this.resource}/appointments/${id}`, 'DELETE');
    }

    async donations(params: object = {}): Promise<any> {
        return await this.request(`${this.resource}/donations`, 'GET', params);
    }

    async notifications(params: object = {}): Promise<any> {
        return await this.request(`${this.resource}/notifications`, 'GET', params);
    }

    async notificationsUnreadCount(): Promise<any> {
        return await this.request(`${this.resource}/notifications/unread-count`, 'GET');
    }

    async markNotificationAsRead(uuid: string): Promise<any> {
        return await this.request(`${this.resource}/notifications/${uuid}`, 'PATCH');
    }

    async markAllNotificationsAsRead(): Promise<any> {
        return await this.request(`${this.resource}/notifications/mark-all-read`, 'POST');
    }

    async updateAvatar(formData: FormData): Promise<any> {
        return await this.request(`${this.resource}/avatar`, 'POST', formData);
    }

    async submitIdentity(formData: FormData): Promise<any> {
        return await this.request(`${this.resource}/identity`, 'POST', formData);
    }

    /**
     * Fetch an identity document as a blob.
     *
     * The route is authenticated rather than signed, so the token has to travel
     * with the request; the caller turns the blob into an object URL.
     */
    async identityImage(uuid: string): Promise<Blob> {
        return await this.requestBlob(`${this.resource}/${uuid}/identity-image`);
    }

    async deleteAccount(payload: { password: string }): Promise<any> {
        return await this.request(`${this.resource}/account`, 'DELETE', payload);
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
