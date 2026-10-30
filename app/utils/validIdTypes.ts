/**
 * The government IDs a donor can present, each with a sample of how its
 * number is printed and where to find it on the card (2026-10-30). Shown as
 * the ID number's placeholder and hint; nothing here checks the format, so a
 * card printed differently is still accepted. Keyed by the server's ValidIdType.
 */
export interface ValidIdType {
  value: string
  label: string
  /** How the number reads on the card, for the placeholder. */
  sample: string
  /** Where it is on the card and what it is called there. */
  hint: string
  /** What the number is called, for the placeholder when the sample is too long to fit. */
  short?: string
}

export const VALID_ID_TYPES: ValidIdType[] = [
  { value: 'philsys', label: 'PhilSys (National ID)', sample: '1234-5678-9012-3456', hint: 'The 16-digit PhilSys Card Number (PCN) on the front of the card.' },
  { value: 'umid', label: 'UMID', sample: '0111-2345678-9', hint: 'The 12-digit Common Reference Number (CRN) on the front.' },
  { value: 'drivers_license', label: "Driver's License", sample: 'N01-23-456789', hint: 'The license number on the front, beside the photo.' },
  { value: 'passport', label: 'Passport', sample: 'P1234567A', hint: 'The passport number at the top right of the photo page.' },
  { value: 'postal_id', label: 'Postal ID', sample: '1234 5678 9012', hint: 'The Postal Reference Number (PRN) on the front.' },
  { value: 'prc_id', label: 'PRC ID', sample: '0123456', hint: 'The registration number on the front.' },
  { value: 'voters_id', label: "Voter's ID", sample: '1234-5678A-B1234CDE12345-6', hint: "The Voter's Identification Number (VIN) on the front.", short: 'VIN' },
  { value: 'sss_id', label: 'SSS ID', sample: '34-1234567-8', hint: 'The 10-digit SS number on the front.' },
]

// Longer than this, a sample no longer fits the field and is cut off.
const PLACEHOLDER_MAX = 20

/**
 * The sample and hint for a chosen type; a general one before a type is picked.
 * A sample too long for the field moves into the hint, where it shows whole.
 */
export function validIdFormat(type: string | null | undefined): { placeholder: string, hint: string } {
  const found = VALID_ID_TYPES.find((t) => t.value === type)
  if (!found) return { placeholder: 'Choose the ID type first', hint: '' }
  if (found.sample.length <= PLACEHOLDER_MAX) return { placeholder: `e.g. ${found.sample}`, hint: found.hint }

  return {
    placeholder: `${found.short ?? 'Number'} as printed on the card`,
    hint: `${found.hint.replace(/\.$/, '')}, e.g. ${found.sample}.`,
  }
}
