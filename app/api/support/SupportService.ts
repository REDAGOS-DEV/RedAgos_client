import BaseService from '../BaseService';

class SupportService extends BaseService {
    private static instance: SupportService;

    public static getInstance(): SupportService {
        if (!SupportService.instance) {
            SupportService.instance = new SupportService();
        }
        return SupportService.instance;
    }

    private resource = '/support';

    async contactInfo(): Promise<any> {
        return await this.request(`${this.resource}/contact-info`, 'GET');
    }
}

export const supportService = SupportService.getInstance();
