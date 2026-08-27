import BaseService from '../BaseService';

class BookingCatalogService extends BaseService {
    private static instance: BookingCatalogService;

    public static getInstance(): BookingCatalogService {
        if (!BookingCatalogService.instance) {
            BookingCatalogService.instance = new BookingCatalogService();
        }
        return BookingCatalogService.instance;
    }

    async bloodCenters(): Promise<any> {
        return await this.request('/blood-centers', 'GET');
    }

    async timeSlots(params: { center_id: number; date: string }): Promise<any> {
        return await this.request('/time-slots', 'GET', params);
    }

    async bloodDrives(): Promise<any> {
        return await this.request('/blood-drives', 'GET');
    }
}

export const bookingCatalogService = BookingCatalogService.getInstance();
