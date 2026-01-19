const metaToken = process.env.META_WHATSAPP_TOKEN;    // Access Token
const metaPhoneId = process.env.META_PHONE_ID;          // Phone Number ID (from Meta Dashboard)

export type WhatsAppMessage = {
    to: string;
    body: string;
};

export const sendWhatsAppMessage = async (message: WhatsAppMessage): Promise<{ success: boolean; id?: string; error?: any }> => {
    // 1. Sanitize Phone Number
    // Remove spaces/dashes. Meta requires country code without +.
    // Example: 351912345678 (no +)
    let phone = message.to.replace(/\s+/g, '').replace(/-/g, '').replace(/\+/g, '');

    // Simple heuristic: if length is 9, assume PT and add 351
    if (phone.length === 9) {
        phone = '351' + phone;
    }

    console.log(`📨 [WhatsApp Meta] Attempting to send to ${phone}...`);

    if (!metaToken || !metaPhoneId) {
        console.warn("⚠️ [WhatsApp] Meta Keys Missing (META_WHATSAPP_TOKEN / META_PHONE_ID). Logging message only:");
        console.log("---------------------------------------------------");
        console.log(`To: ${phone}`);
        console.log(`Body: ${message.body}`);
        console.log("---------------------------------------------------");
        return { success: true, id: 'mock-meta-id-' + Date.now() };
    }

    try {
        const url = `https://graph.facebook.com/v17.0/${metaPhoneId}/messages`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${metaToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: phone,
                type: 'text',
                text: { body: message.body }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ [WhatsApp Meta] API Error:", JSON.stringify(data, null, 2));
            return { success: false, error: data };
        }

        console.log(`✅ [WhatsApp Meta] Sent! Message ID: ${data.messages?.[0]?.id}`);
        return { success: true, id: data.messages?.[0]?.id };

    } catch (error: any) {
        console.error("❌ [WhatsApp Meta] Network/System Failed:", error);
        return { success: false, error: error.message };
    }
};
