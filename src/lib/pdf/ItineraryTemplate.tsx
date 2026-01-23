import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register a serif font for that "5-star" look if possible, or use standard
// For now using standard, but layout will be premium.

const styles = StyleSheet.create({
    page: {
        padding: 0,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
    },
    // Cover Section
    heroSection: {
        height: 500,
        position: 'relative',
        backgroundColor: '#0f172a',
    },
    heroImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    heroOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 250,
        padding: 40,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        justifyContent: 'flex-end',
    },
    badge: {
        backgroundColor: '#ca8a04',
        color: '#ffffff',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 10,
        width: 150,
        textAlign: 'center',
    },
    title: {
        fontSize: 36,
        color: '#ffffff',
        fontWeight: 'bold',
        marginBottom: 10,
        lineHeight: 1.1,
    },
    datesCover: {
        fontSize: 16,
        color: '#fbbf24',
        fontWeight: 'bold',
    },
    // Welcome Message
    welcomeBox: {
        padding: 40,
        backgroundColor: '#f8fafc',
        borderLeftWidth: 4,
        borderLeftColor: '#fbbf24',
        marginVertical: 20,
    },
    welcomeTitle: {
        fontSize: 22,
        color: '#0f172a',
        fontWeight: 'bold',
        marginBottom: 10,
    },
    welcomeText: {
        fontSize: 12,
        color: '#475569',
        lineHeight: 1.6,
        fontStyle: 'italic',
    },
    // Content Sections
    section: {
        paddingHorizontal: 40,
        paddingVertical: 20,
    },
    sectionTitle: {
        fontSize: 18,
        color: '#1e293b',
        fontWeight: 'bold',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 8,
    },
    description: {
        fontSize: 11,
        color: '#475569',
        lineHeight: 1.6,
        marginBottom: 20,
    },
    // Itinerary List
    itineraryItem: {
        marginBottom: 15,
        flexDirection: 'row',
        gap: 15,
    },
    dayCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#ca8a04',
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingTop: 5,
    },
    dayContent: {
        flex: 1,
    },
    dayTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
    },
    dayDescription: {
        fontSize: 9,
        color: '#64748b',
        lineHeight: 1.4,
    },
    // Inclusions Checklist
    checklist: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 10,
    },
    checkItem: {
        width: '45%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 5,
    },
    checkText: {
        fontSize: 10,
        color: '#1e293b',
    },
    // Scarcity & Urgency
    urgencyBanner: {
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fef3c7',
        borderRadius: 8,
        padding: 15,
        marginTop: 20,
    },
    urgencyTitle: {
        fontSize: 12,
        color: '#92400e',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    urgencyText: {
        fontSize: 10,
        color: '#b45309',
    },
    // Conversion Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingHorizontal: 40,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ctaButton: {
        backgroundColor: '#ca8a04',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    contactInfo: {
        fontSize: 9,
        color: '#64748b',
        lineHeight: 1.5,
    },
    brand: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1e293b',
    }
});

interface ItineraryTemplateProps {
    pilgrimage: any;
    itinerary: any[];
    currency?: 'EUR' | 'BRL';
    exchangeRate?: number;
}

export const ItineraryTemplate = ({ pilgrimage, itinerary, currency = 'EUR', exchangeRate = 1 }: ItineraryTemplateProps) => {
    const vacancies = pilgrimage.effective_vacancies || 0;
    const isLastVancancies = vacancies > 0 && vacancies <= 10;

    const formatConvertedPrice = (amountInEur: number) => {
        if (currency === 'EUR') {
            return `${amountInEur.toFixed(2)}€`;
        }
        const converted = amountInEur * exchangeRate;
        // Format as R$
        return `R$ ${converted.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    return (
        <Document title={`Roteiro - ${pilgrimage.title}`}>
            <Page size="A4" style={styles.page}>
                {/* Cover Page */}
                <View style={styles.heroSection}>
                    {pilgrimage.cover_image && (
                        <Image src={pilgrimage.cover_image} style={styles.heroImage} />
                    )}
                    <View style={styles.heroOverlay}>
                        <Text style={styles.badge}>Apostolado Oficial Garabandal</Text>
                        <Text style={styles.title}>{pilgrimage.title}</Text>
                        <Text style={styles.datesCover}>Onde o Céu Toca a Terra</Text>
                    </View>
                </View>

                {/* Welcome Message Section */}
                <View style={styles.welcomeBox}>
                    <Text style={styles.welcomeTitle}>Nossa Senhora o Espera</Text>
                    <Text style={styles.welcomeText}>
                        "Não deixe esta graça passar. Garabandal não é apenas uma viagem, é um encontro profundo com o Céu.
                        Muitas graças esperam por aqueles que respondem ao chamado com o coração aberto."
                    </Text>
                </View>

                {/* About Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>A Experiência</Text>
                    <Text style={styles.description}>
                        Junte-se ao Apostolado nesta jornada de transformação espiritual. Uma peregrinação oficial focada na
                        oração, no silêncio e na vivência profunda da Mensagem deixada pela Virgem Maria.
                    </Text>

                    {/* Urgency Message if applicable */}
                    {isLastVancancies && (
                        <View style={styles.urgencyBanner}>
                            <Text style={styles.urgencyTitle}>⚠️ Atenção: Vagas Limitadas</Text>
                            <Text style={styles.urgencyText}>Restam apenas {vacancies} lugares disponíveis para este grupo exclusivo.</Text>
                        </View>
                    )}
                </View>

                {/* Logistics Checklist Section */}
                <View style={[styles.section, { backgroundColor: '#ffffff' }]}>
                    <Text style={styles.sectionTitle}>O que Incluímos para a Sua Tranquilidade</Text>
                    <View style={styles.checklist}>
                        <View style={styles.checkItem}>
                            <Text style={styles.checkText}>✓ Alojamento em Pensão Completa</Text>
                        </View>
                        <View style={styles.checkItem}>
                            <Text style={styles.checkText}>✓ Guia Espiritual do Apostolado</Text>
                        </View>
                        <View style={styles.checkItem}>
                            <Text style={styles.checkText}>✓ Seguro de Viagem Completo</Text>
                        </View>
                        <View style={styles.checkItem}>
                            <Text style={styles.checkText}>✓ Transporte e Transfers Locais</Text>
                        </View>
                        <View style={styles.checkItem}>
                            <Text style={styles.checkText}>✓ Conferências e Momentos de Oração</Text>
                        </View>
                        <View style={styles.checkItem}>
                            <Text style={styles.checkText}>✓ Experiência em Pequenos Grupos</Text>
                        </View>
                    </View>
                </View>

                {/* Itinerary Page Start */}
                <View style={styles.section} break>
                    <Text style={styles.sectionTitle}>Roteiro Diário</Text>
                    {itinerary.map((item, index) => (
                        <View key={item.id} style={styles.itineraryItem} wrap={false}>
                            <View>
                                <Text style={styles.dayCircle}>{item.day_number || index + 1}</Text>
                            </View>
                            <View style={styles.dayContent}>
                                <Text style={styles.dayTitle}>{item.title}</Text>
                                <Text style={styles.dayDescription}>{item.description}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Footer with CTA */}
                <View style={styles.footer} fixed>
                    <View>
                        <Text style={[styles.brand, { color: '#ca8a04' }]}>Garantir o Meu Lugar</Text>
                        <Text style={styles.contactInfo}>
                            Valor Total: {formatConvertedPrice((pilgrimage.base_price || 0) + (pilgrimage.deposit_value || 0))}
                            {currency === 'BRL' && ' (Câmbio Estimado)'}
                        </Text>
                        <Text style={styles.contactInfo}>geral@apostoladodegarabandal.com | www.apostoladodegarabandal.com</Text>
                    </View>
                    <View>
                        <Text style={styles.ctaButton}>INSCREVER AGORA</Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
};
