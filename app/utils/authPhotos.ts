/**
 * Photos for the landing page and the sign-in, registration and get-started
 * screens. Each one was opened and checked before use; the alt text describes
 * what is actually in the frame.
 *
 * Donor and hospital photos are Philippine: a Philippine Red Cross blood drive,
 * a PRC nurse and a Philippine General Hospital ward, served from
 * `public/images/photos/` (see the README there for sources and licences). The
 * lab photos are still stock from Unsplash because no free Philippine
 * equivalent was found; replace them with RedAgos's own photos of Davao
 * facilities when the team has them.
 */

export type AuthPhotoKey =
  | 'donation'
  | 'screening'
  | 'registration'
  | 'drive'
  | 'hospital'
  | 'microscope'
  | 'lab'

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=760&h=600&q=70&auto=format&fit=crop`

const PHOTOS: Record<AuthPhotoKey, { src: string, alt: string }> = {
  donation: {
    src: '/images/photos/prc-blood-draw.jpg',
    alt: 'A Philippine Red Cross nurse drawing blood from a donor',
  },
  screening: {
    src: '/images/photos/prc-physical-assessment.jpg',
    alt: 'A donor\'s physical assessment at a Philippine Red Cross blood drive',
  },
  registration: {
    src: '/images/photos/prc-registration.jpg',
    alt: 'Philippine Red Cross staff registering a donor at a blood drive',
  },
  drive: {
    src: '/images/photos/prc-drive-cots.jpg',
    alt: 'Donors resting on cots while Philippine Red Cross staff attend to them at a mall blood drive',
  },
  hospital: {
    src: '/images/photos/pgh-ward.jpg',
    alt: 'A ward of the Philippine General Hospital in Manila',
  },
  microscope: {
    src: unsplash('1582719471384-894fbb16e074'),
    alt: 'A laboratory scientist examining a sample under a microscope',
  },
  lab: {
    src: unsplash('1579154204601-01588f351e67'),
    alt: 'Laboratory staff working between rows of testing equipment',
  },
}

/** `src` and `alt` for one photo. */
export function authPhoto(key: AuthPhotoKey): { src: string, alt: string } {
  return { ...PHOTOS[key] }
}
