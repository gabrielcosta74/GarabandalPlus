import { z } from 'zod';

const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');

export const checkinSubmissionSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  nationality: z.string().trim().min(2).max(100),
  document_type: z.enum(['citizen_card', 'passport']),
  document_number: z.string().trim().min(3).max(80),
  document_issued_on: civilDate,
  document_expires_on: civilDate,
  birth_date: civilDate,
  full_address: z.string().trim().min(5).max(400),
  postal_code: z.string().trim().min(2).max(30),
  city: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().max(200),
  privacy_consent: z.literal(true),
  website: z.string().max(0).optional(),
}).superRefine((value, context) => {
  if (value.document_issued_on > value.document_expires_on) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['document_expires_on'],
      message: 'A validade deve ser posterior à emissão.',
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (value.birth_date >= today) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['birth_date'],
      message: 'A data de nascimento deve ser anterior a hoje.',
    });
  }
});

export type CheckinSubmissionInput = z.infer<typeof checkinSubmissionSchema>;

export const CHECKIN_EXPORT_HEADERS = [
  'Nº',
  'Nome / Nombre /  Name / Nom',
  'NACIONALIDADE / NATIONALITY / NATIONALITÉ',
  'Tipo de documento ( Cartão de cidadão ou Passaporte) / Document type (Citizen Card or Passport) / Type de document (carte de citoyen ou passeport)',
  'Nº Documento / Document n°',
  "Data emissão / Date of issue / Date d'émission",
  "Data validade / Expiration date / Date d'expiration",
  'Data de nascimento / Date of birth / Date de naissance',
  'Endereço completo / full address / Adresse complète',
  'Codigo Postal ( CEP) / Postcode / Code Postal',
  'Localidade/ Town / Ville',
  'Numero de telefone / Telephone number / Numéro de téléphone',
  'Email',
] as const;

export function documentTypeLabel(type: string) {
  return type === 'passport' ? 'Passaporte' : 'Cartão de cidadão';
}
