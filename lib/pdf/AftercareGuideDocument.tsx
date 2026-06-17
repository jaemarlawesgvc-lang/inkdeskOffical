import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: '#171717', fontFamily: 'Helvetica' },
  header: { marginBottom: 24, borderBottom: '2pt solid #171717', paddingBottom: 12 },
  brand: { fontSize: 10, color: '#737373', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 700 },
  subtitle: { fontSize: 11, color: '#525252', marginTop: 4 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  stageRow: { marginBottom: 8, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 },
  stageLabel: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  stageBody: { fontSize: 10, color: '#404040' },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 10, fontSize: 10 },
  bulletText: { fontSize: 10, flex: 1, color: '#262626' },
  doTitle: { fontSize: 12, fontWeight: 700, color: '#15803d', marginBottom: 6 },
  dontTitle: { fontSize: 12, fontWeight: 700, color: '#b91c1c', marginBottom: 6 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: '1pt solid #e5e5e5', paddingTop: 10, fontSize: 9, color: '#a3a3a3', textAlign: 'center' },
})

interface AftercareGuideDocumentProps {
  artistName: string
  studioName: string | null
  contactEmail: string
}

const DO_ITEMS = [
  'Wash gently with lukewarm water and fragrance-free soap',
  'Pat dry with a clean paper towel — never rub',
  'Apply a thin layer of fragrance-free moisturiser 2–3 times daily',
  'Wear loose, breathable clothing over the tattoo',
  'Keep it out of direct sunlight',
]

const DONT_ITEMS = [
  'Submerge in water (baths, pools, hot tubs) for 2–4 weeks',
  'Pick, scratch, or peel flaking skin',
  'Apply petroleum jelly or products with fragrances',
  'Expose to direct sunlight or tanning beds',
  'Exercise intensely for the first 48 hours',
]

export function AftercareGuideDocument({ artistName, studioName, contactEmail }: AftercareGuideDocumentProps) {
  return (
    <Document title={`Aftercare Guide — ${artistName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>InkDesk</Text>
          <Text style={styles.title}>Tattoo Aftercare Guide</Text>
          <Text style={styles.subtitle}>
            {studioName ? `${artistName} · ${studioName}` : artistName}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Healing stages (days 1–14)</Text>
          <View style={styles.stageRow}>
            <Text style={styles.stageLabel}>Days 1–3</Text>
            <Text style={styles.stageBody}>Redness, slight swelling, and oozing are normal. Keep the area clean and moisturised.</Text>
          </View>
          <View style={styles.stageRow}>
            <Text style={styles.stageLabel}>Days 4–14</Text>
            <Text style={styles.stageBody}>The tattoo will start to peel and flake. This is normal — do not pick or scratch it.</Text>
          </View>
          <View style={styles.stageRow}>
            <Text style={styles.stageLabel}>Weeks 2–4</Text>
            <Text style={styles.stageBody}>The outer layer heals. The tattoo may look slightly dull — this is temporary. Full healing takes 4–6 weeks.</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.doTitle}>Do</Text>
          {DO_ITEMS.map((item) => (
            <View style={styles.bullet} key={item}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.dontTitle}>Don&rsquo;t</Text>
          {DONT_ITEMS.map((item) => (
            <View style={styles.bullet} key={item}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>When to contact your artist</Text>
          <Text style={styles.stageBody}>
            If you notice excessive redness, swelling, pus, or a rash that lasts more than a few days,
            reach out to your artist or consult a healthcare professional. Minor issues during healing
            are normal, but it&rsquo;s always better to check.
          </Text>
        </View>

        <Text style={styles.footer}>
          Provided by {artistName} via InkDesk · Questions? Contact {contactEmail}
        </Text>
      </Page>
    </Document>
  )
}
