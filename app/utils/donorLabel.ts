/**
 * How a donation is named on the laboratory and inventory screens.
 *
 * Those roles work blind: the server withholds the donor's identity from them
 * and sends `{ blinded: true, blood_type }` instead. They match a sample to its
 * record by what is printed on the bag, so that is what the title becomes.
 * The roles that meet donors in person still receive the name.
 */

export interface DonorBlock {
  blinded?: boolean
  full_name?: string | null
  donor_code?: string | null
  blood_type?: string | null
}

/**
 * The row or unit-bar title: the donor's name, or the bag's segment number.
 */
export function donorTitle(
  donor: DonorBlock | null | undefined,
  segmentNumber: string | null | undefined,
  donationId: number | string | null | undefined,
): string {
  if (donor?.blinded) {
    if (segmentNumber) return `Segment ${segmentNumber}`

    return donationId ? `Donation #${donationId}` : 'Unlabelled unit'
  }

  return donor?.full_name || 'Unknown donor'
}

/**
 * The secondary reference beside the donation number.
 */
export function donorReference(donor: DonorBlock | null | undefined): string {
  if (donor?.blinded) return 'Blind — by barcode'

  return donor?.donor_code || '—'
}

/**
 * Two initials for the avatar, or '' when there is no name to take them from.
 */
export function donorInitials(donor: DonorBlock | null | undefined): string {
  if (donor?.blinded) return ''

  return (donor?.full_name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}
