import {
  calculateInstallments,
  getMaxInstallments,
} from '../../../../lib/pilgrimage-installments';
import { getBookingDepositAmount } from './bookings';

type MobileParticipant = Record<string, unknown>;
type MobileRoom = Record<string, unknown>;

const ROOM_CAPACITY: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  family: 4,
};

const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const snakeRoomType = (type: string) => type === 'family' ? 'quadruple' : type;

export class MobileRegistrationError extends Error {}

export function mapMobileParticipants(input: {
  participants: unknown;
  rooms: unknown;
  sessionEmail: string;
  roomSupplements?: Record<string, unknown> | null;
}) {
  if (!Array.isArray(input.participants) || input.participants.length === 0) {
    throw new MobileRegistrationError('Adiciona pelo menos um participante.');
  }
  if (!Array.isArray(input.rooms) || input.rooms.length === 0) {
    throw new MobileRegistrationError('Distribui os participantes pelos quartos.');
  }

  const participants = input.participants as MobileParticipant[];
  const rooms = input.rooms as MobileRoom[];
  const participantIds = new Set<string>();
  participants.forEach((participant, index) => {
    const id = clean(participant.id, 100);
    if (!id || participantIds.has(id)) throw new MobileRegistrationError('Participantes inválidos ou repetidos.');
    if (!clean(participant.fullName ?? participant.full_name, 120)) {
      throw new MobileRegistrationError(`O nome do participante ${index + 1} é obrigatório.`);
    }
    participantIds.add(id);
  });

  const roomByOccupant = new Map<string, MobileRoom>();
  for (const room of rooms) {
    const type = clean(room.type ?? room.room_type, 20);
    const occupants = Array.isArray(room.occupantIds ?? room.occupant_ids)
      ? (room.occupantIds ?? room.occupant_ids) as unknown[]
      : [];
    if (!ROOM_CAPACITY[type] || occupants.length === 0 || occupants.length > ROOM_CAPACITY[type]) {
      throw new MobileRegistrationError('A distribuição de quartos é inválida.');
    }
    const pricingType = snakeRoomType(type);
    if (
      type !== 'double'
      && !Object.prototype.hasOwnProperty.call(input.roomSupplements ?? {}, pricingType)
    ) {
      throw new MobileRegistrationError(`A opção de quarto ${type} não está disponível.`);
    }
    for (const rawOccupantId of occupants) {
      const occupantId = clean(rawOccupantId, 100);
      if (!participantIds.has(occupantId) || roomByOccupant.has(occupantId)) {
        throw new MobileRegistrationError('Cada participante deve estar atribuído exatamente a um quarto.');
      }
      roomByOccupant.set(occupantId, room);
    }
  }
  if (roomByOccupant.size !== participants.length) {
    throw new MobileRegistrationError('Cada participante deve estar atribuído exatamente a um quarto.');
  }

  return participants.map((participant, index) => {
    const participantId = clean(participant.id, 100);
    const room = roomByOccupant.get(participantId)!;
    const occupantIds = (room.occupantIds ?? room.occupant_ids) as unknown[];
    const roommateNames = occupantIds
      .map((id) => participants.find((candidate) => clean(candidate.id, 100) === clean(id, 100)))
      .filter((candidate): candidate is MobileParticipant => Boolean(candidate))
      .filter((candidate) => clean(candidate.id, 100) !== participantId)
      .map((candidate) => clean(candidate.fullName ?? candidate.full_name, 120));
    const roommateName = clean(room.roommateName ?? room.roommate_name, 200)
      || roommateNames.join(', ');
    const bedPreference = clean(room.bedPreference ?? room.bed_preference, 30);
    const sharingMode = clean(room.sharingMode ?? room.sharing_mode, 30);
    const roomId = clean(room.id, 100).replace(/[^A-Za-z0-9._:-]/g, '') || `room-${index + 1}`;
    const markers = [
      bedPreference ? `[Pref. Cama: ${bedPreference === 'double_bed' ? 'Casal' : 'Twin'}]` : '',
      sharingMode ? `[Modo Partilha: ${sharingMode === 'random' ? 'Aleatório' : sharingMode === 'partner' ? 'Com Amigo' : 'Agregado'}]` : '',
      roommateName ? `[Com Quem: ${roommateName}]` : '',
      `[Quarto: ${roomId}]`,
    ].filter(Boolean).join('\n');
    const notes = [clean(participant.notes, 1000), markers].filter(Boolean).join('\n');

    return {
      full_name: clean(participant.fullName ?? participant.full_name, 120),
      email: index === 0 ? input.sessionEmail : clean(participant.email, 200).toLowerCase(),
      phone: clean(participant.phone, 40),
      birth_date: clean(participant.birthDate ?? participant.birth_date, 20),
      sex: participant.sex === 'F' ? 'F' : 'M',
      address: clean(participant.address, 200),
      postal_code: clean(participant.postalCode ?? participant.postal_code, 40),
      city: clean(participant.city, 100),
      country: clean(participant.country, 100),
      cpf_nif: clean(participant.taxId ?? participant.cpf_nif, 30),
      allergies: clean(participant.allergies, 1000),
      health_notes: clean(participant.healthNotes ?? participant.health_notes, 1000),
      notes,
      room_type: snakeRoomType(clean(room.type ?? room.room_type, 20)),
      flight_option: clean(participant.flightOption ?? participant.flight_option, 30),
      flight_policy_acknowledged: participant.flightPolicyAcknowledged === true
        || participant.flight_policy_acknowledged === true,
    };
  });
}

export function buildInstallmentPlan(input: {
  paymentMethod: 'full' | 'installments';
  totalAmount: number;
  depositPerParticipant: number;
  participants: Array<Record<string, unknown>>;
  startDate: string;
  installmentDeadline?: string | null;
  installmentCount?: number | null;
  now?: Date;
}) {
  if (input.paymentMethod === 'full') return null;
  const maximum = getMaxInstallments(
    input.startDate,
    input.installmentDeadline,
    input.now,
  );
  const desired = input.installmentCount ?? maximum;
  if (!Number.isInteger(desired) || desired < 1 || desired > maximum) {
    throw new MobileRegistrationError(`Escolhe entre 1 e ${maximum} prestações.`);
  }
  const depositTotal = getBookingDepositAmount(input.participants, input.depositPerParticipant);
  const balance = Math.max(0, input.totalAmount - depositTotal);
  return calculateInstallments(
    balance,
    input.startDate,
    desired,
    input.installmentDeadline,
    input.now,
  );
}
