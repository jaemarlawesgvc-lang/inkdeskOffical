export const MEDICAL_QUESTIONS = [
  { id: 'blood_thinners', text: 'Are you currently taking blood thinners or anticoagulant medication?' },
  { id: 'skin_conditions', text: 'Do you have any skin conditions (eczema, psoriasis, keloid scarring, etc.)?' },
  { id: 'pregnant_breastfeeding', text: 'Are you currently pregnant or breastfeeding?' },
  { id: 'diabetes_epilepsy_heart', text: 'Do you have diabetes, epilepsy, or a heart condition?' },
  { id: 'allergies', text: 'Are you allergic to latex, lidocaine, or tattoo pigments?' },
  { id: 'alcohol_drugs_24h', text: 'Have you consumed alcohol or recreational drugs in the last 24 hours?' },
] as const

export type MedicalQuestionId = (typeof MEDICAL_QUESTIONS)[number]['id']

export type MedicalAnswers = Record<MedicalQuestionId, 'yes' | 'no'>
