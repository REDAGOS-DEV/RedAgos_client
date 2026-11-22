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

    /** The landing page's upcoming drives. No sign-in. [{ id, name, location, date, start_time, end_time }] */
    async publicDrives(): Promise<any> {
        return await this.request('/public/drives', 'GET');
    }
}

export const bookingCatalogService = BookingCatalogService.getInstance();
