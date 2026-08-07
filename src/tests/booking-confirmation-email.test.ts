import { describe, expect, it } from 'vitest';
import {
  renderBookingAccessLinkEmail,
  renderBookingConfirmationEmail,
} from '../lib/email-renderer';

describe('booking confirmation email', () => {
  it('uses an explicit payment CTA with the direct secure booking URL', () => {
    const bookingUrl = 'https://apostoladodegarabandal.com/peregrinacoes/inscricao/booking-1?viewToken=secure-token&token=secure-token';
    const autoLoginUrl = 'https://apostoladodegarabandal.com/auth/confirm?token_hash=one-time&type=magiclink';
    const email = renderBookingConfirmationEmail({
      bookingId: 'booking-1',
      email: 'maria@example.com',
      pilgrimageName: 'Garabandal Outubro',
      amount: 500,
      totalAmount: 1750,
      paymentMethod: 'installments',
      magicLink: autoLoginUrl,
      directBookingUrl: bookingUrl,
      locale: 'pt',
    });

    expect(email.subject).toContain('Garabandal Outubro');
    expect(email.html).toContain('Pagar Sinal Agora');
    expect(email.html).toContain(`href="${autoLoginUrl}"`);
    expect(email.html).toContain(`href="${bookingUrl.replace(/&/g, '&amp;')}"`);
    expect(email.html).toContain('inicia a sessão automaticamente');
    expect(email.html).toContain('abra diretamente a sua inscrição aqui');
  });

  it('does not promise automatic login when only the booking-scoped fallback is available', () => {
    const bookingUrl = 'https://apostoladodegarabandal.com/peregrinacoes/inscricao/booking-2?viewToken=secure-token';
    const email = renderBookingAccessLinkEmail({
      accessLink: bookingUrl,
      directAccessLink: bookingUrl,
      pilgrimageName: 'Garabandal Maio',
      locale: 'pt',
    });

    expect(email.html).toContain('Use o botão seguro abaixo para abrir a sua inscrição.');
    expect(email.html).not.toContain('iniciar sessão automaticamente');
  });
});
