import BaseService from '../BaseService';

/**
 * A drive's registration link (/drives/{token}): public, no sign-in. The
 * token is the only key, and the server never answers with anyone's details.
 */
class DriveLinkService extends BaseService {
    private static instance: DriveLinkService;

    public static getInstance(): DriveLinkService {
        if (!DriveLinkService.instance) {
            DriveLinkService.instance = new DriveLinkService();
        }
        return DriveLinkService.instance;
    }

    /** { drive: { name, location, event_date, start_time, end_time, announcement, centre_name, state, cancellation_reason }, self_check: [{ key, label }], group_max_people } */
    async drive(token: string): Promise<any> {
        return await this.request(`/drive-links/${token}`, 'GET');
    }

    /** A person putting themselves on the list. { message, drive_name, needs_review } */
    async registerSelf(token: string, payload: Record<string, unknown>): Promise<any> {
        return await this.request(`/drive-links/${token}/registrations`, 'POST', payload);
    }

    /** A partner putting its people on the list. { message, drive_name, received } */
    async registerGroup(token: string, payload: Record<string, unknown>): Promise<any> {
        return await this.request(`/drive-links/${token}/group-registrations`, 'POST', payload);
    }
}

export const driveLinkService = DriveLinkService.getInstance();
