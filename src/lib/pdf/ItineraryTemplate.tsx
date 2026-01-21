import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register a serif font for that "5-star" look if possible, or use standard
// For now using standard, but layout will be premium.

const styles = StyleSheet.create({
    page: {
        padding: 0,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
    },
    heroSection: {
        height: 400,
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
        height: 150,
        padding: 40,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
    },
    title: {
        fontSize: 32,
        color: '#ffffff',
        fontWeight: 'bold',
        marginBottom: 5,
    },
    dates: {
        fontSize: 14,
        color: '#fbbf24',
        fontWeight: 'bold',
    },
    content: {
        padding: 40,
    },
    sectionTitle: {
        fontSize: 20,
        color: '#1e293b',
        fontWeight: 'bold',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#fbbf24',
        paddingBottom: 5,
    },
    description: {
        fontSize: 12,
        color: '#475569',
        lineHeight: 1.6,
        marginBottom: 20,
    },
    itineraryItem: {
        marginBottom: 20,
        flexDirection: 'row',
        gap: 15,
    },
    dayCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#fef3c7',
        color: '#b45309',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingTop: 6,
    },
    dayContent: {
        flex: 1,
    },
    dayTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
    },
    dayDescription: {
        fontSize: 10,
        color: '#64748b',
        lineHeight: 1.4,
    },
    dayImage: {
        width: 150,
        height: 80,
        borderRadius: 8,
        marginTop: 8,
        objectFit: 'cover',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingHorizontal: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    footerText: {
        fontSize: 9,
        color: '#94a3b8',
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
}

export const ItineraryTemplate = ({ pilgrimage, itinerary }: ItineraryTemplateProps) => (
    <Document title={`Roteiro - ${pilgrimage.title}`}>
        <Page size="A4" style={styles.page}>
            {/* Hero */}
            <View style={styles.heroSection}>
                {pilgrimage.cover_image && (
                    <Image src={pilgrimage.cover_image} style={styles.heroImage} />
                )}
                <View style={styles.heroOverlay}>
                    <Text style={styles.title}>{pilgrimage.title}</Text>
                    <Text style={styles.dates}>Peregrinação Oficial Garabandal</Text>
                </View>
            </View>

            <View style={styles.content}>
                <Text style={styles.sectionTitle}>Sobre a Viagem</Text>
                <Text style={styles.description}>{pilgrimage.description}</Text>

                <Text style={styles.sectionTitle}>Roteiro Espiritual</Text>
                {itinerary.map((item, index) => (
                    <View key={item.id} style={styles.itineraryItem} wrap={false}>
                        <View>
                            <Text style={styles.dayCircle}>{item.day_number || index + 1}</Text>
                        </View>
                        <View style={styles.dayContent}>
                            <Text style={styles.dayTitle}>{item.title}</Text>
                            <Text style={styles.dayDescription}>{item.description}</Text>
                            {item.image_url && (
                                <Image src={item.image_url} style={styles.dayImage} />
                            )}
                        </View>
                    </View>
                ))}
            </View>

            <View style={styles.footer} fixed>
                <Text style={styles.brand}>Apostolado de Garabandal em Portugal</Text>
                <Text style={styles.footerText}>geral@apostoladodegarabandal.pt | www.apostoladodegarabandal.com</Text>
            </View>
        </Page>
    </Document>
);
