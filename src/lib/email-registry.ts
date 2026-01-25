import {
    renderBookingConfirmationEmail,
    renderStoreOwnerEmail,
    renderStoreBuyerEmail,
    renderStoreShippingEmail,
    renderStorePreparingEmail
} from './email-renderer';

// Define the Registry Structure
export const EMAIL_REGISTRY = {
    // Booking Flow
    'booking_confirmation': {
        label: 'Confirmação de Reserva',
        description: 'Enviado ao peregrino após inscrição com sucesso.',
        recipient: 'Peregrino',
        render: (data: any) => renderBookingConfirmationEmail(data || {
            pilgrimageName: 'Peregrinação a Garabandal',
            bookingId: 'MOCK-123456',
            email: 'peregrino@example.com',
            amount: 150,
            totalAmount: 450,
            paymentMethod: 'bank_transfer',
            magicLink: 'https://app.example.com/auth/verify?token=mock'
        })
    },

    // Store Flow
    'store_order_owner': {
        label: 'Nova Encomenda (Admin)',
        description: 'Notificação para a loja de nova venda.',
        recipient: 'Admin (Loja)',
        render: (data: any) => renderStoreOwnerEmail(data || {
            orderRef: 'STORE-123',
            buyerName: 'Maria Silva',
            buyerEmail: 'maria@exemplo.com',
            subtotal: '45.90',
            vat: '10.35',
            total: '56.25',
            items: [
                { name: 'Terço de Garabandal', qty: 2, unit_price: 15.00 },
                { name: 'Livro: O Aviso', qty: 1, unit_price: 15.90 }
            ],
            shipping: {
                address1: 'Rua das Flores 123',
                city: 'Lisboa',
                postalCode: '1000-001',
                country: 'Portugal'
            }
        })
    },
    'store_order_buyer': {
        label: 'Confirmação de Encomenda',
        description: 'Recibo enviado ao cliente.',
        recipient: 'Cliente',
        render: (data: any) => renderStoreBuyerEmail(data || {
            orderRef: 'STORE-123',
            buyerName: 'Maria Silva',
            buyerEmail: 'maria@exemplo.com',
            subtotal: '45.90',
            vat: '10.35',
            total: '56.25',
            shippingCost: '3.50',
            shipping: {
                address1: 'Rua das Flores 123',
                city: 'Lisboa',
                postalCode: '1000-001',
                country: 'Portugal'
            }
        })
    },
    'store_order_preparing': {
        label: 'Encomenda em Preparação',
        description: 'Notificação de preparação do envio.',
        recipient: 'Cliente',
        render: (data: any) => renderStorePreparingEmail(data || {
            orderRef: 'STORE-123',
            buyerEmail: 'maria@exemplo.com',
            buyerName: 'Maria Silva'
        })
    },
    'store_order_shipped': {
        label: 'Encomenda Enviada',
        description: 'Notificação de envio com tracking.',
        recipient: 'Cliente',
        render: (data: any) => renderStoreShippingEmail(data || {
            orderRef: 'STORE-123',
            buyerName: 'Maria Silva',
            tracking: 'PT123456789',
            shippedAt: new Date().toISOString()
        })
    }
};

export type EmailTemplateKey = keyof typeof EMAIL_REGISTRY;
