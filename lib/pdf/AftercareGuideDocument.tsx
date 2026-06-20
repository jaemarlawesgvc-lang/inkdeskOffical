import { Document, Page, Text, View, StyleSheet, Svg, Path, Circle } from '@react-pdf/renderer'

const GOLD = '#d4af37'
const INK = '#0a0a0a'

const styles = StyleSheet.create({
  page: { fontSize: 10, color: '#171717', fontFamily: 'Helvetica' },

  // ── Header band ──
  header: { backgroundColor: INK, paddingTop: 36, paddingBottom: 28, paddingHorizontal: 40 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD, marginRight: 6 },
  brand: { fontSize: 9, color: '#a3a3a3', letterSpacing: 2 },
  title: { fontSize: 26, fontWeight: 700, color: '#ffffff' },
  subtitle: { fontSize: 11, color: '#d4d4d4', marginTop: 6 },
  goldLine: { height: 2, backgroundColor: GOLD, width: 48, marginTop: 16 },

  body: { padding: 40, paddingTop: 28, paddingBottom: 60 },

  section: { marginBottom: 20 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#171717' },
  sectionRule: { flex: 1, height: 1, backgroundColor: '#e5e5e5', marginLeft: 10 },

  stageRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-start' },
  stageBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  stageBadgeText: { fontSize: 10, fontWeight: 700, color: GOLD },
  stageContent: { flex: 1, paddingTop: 1 },
  stageLabel: { fontSize: 10.5, fontWeight: 700, color: '#171717', marginBottom: 2 },
  stageBody: { fontSize: 9.5, color: '#525252', lineHeight: 1.4 },

  twoCol: { flexDirection: 'row', gap: 14 },
  card: { flex: 1, borderRadius: 8, padding: 14 },
  doCard: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  dontCard: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 11, fontWeight: 700, marginLeft: 6 },
  bullet: { flexDirection: 'row', marginBottom: 7, alignItems: 'flex-start' },
  bulletIcon: { marginRight: 6, marginTop: 1 },
  bulletText: { fontSize: 9, flex: 1, color: '#262626', lineHeight: 1.35 },

  noteBox: { backgroundColor: '#fafaf9', borderWidth: 1, borderColor: '#e7e5e4', borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 4, padding: 12 },
  noteText: { fontSize: 9.5, color: '#404040', lineHeight: 1.5 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: INK, paddingVertical: 14, paddingHorizontal: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerBrand: { fontSize: 9, color: '#a3a3a3' },
  footerContact: { fontSize: 9, color: '#a3a3a3' },
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

function CheckIcon() {
  return (
    <Svg width={10} height={10} viewBox="0 0 20 20" style={styles.bulletIcon}>
      <Circle cx={10} cy={10} r={10} fill="#22c55e" />
      <Path d="M6 10.5l2.5 2.5L14 7" stroke="#ffffff" strokeWidth={1.8} fill="none" />
    </Svg>
  )
}

function CrossIcon() {
  return (
    <Svg width={10} height={10} viewBox="0 0 20 20" style={styles.bulletIcon}>
      <Circle cx={10} cy={10} r={10} fill="#ef4444" />
      <Path d="M7 7l6 6M13 7l-6 6" stroke="#ffffff" strokeWidth={1.8} fill="none" />
    </Svg>
  )
}

export function AftercareGuideDocument({ artistName, studioName, contactEmail }: AftercareGuideDocumentProps) {
  return (
    <Document title={`Aftercare Guide — ${artistName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brand}>INKQUIRE</Text>
          </View>
          <Text style={styles.title}>Tattoo Aftercare Guide</Text>
          <Text style={styles.subtitle}>
            {studioName ? `${artistName}  ·  ${studioName}` : artistName}
          </Text>
          <View style={styles.goldLine} />
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitle}>Healing stages</Text>
              <View style={styles.sectionRule} />
            </View>

            <View style={styles.stageRow}>
              <View style={styles.stageBadge}><Text style={styles.stageBadgeText}>1</Text></View>
              <View style={styles.stageContent}>
                <Text style={styles.stageLabel}>Days 1–3</Text>
                <Text style={styles.stageBody}>Redness, slight swelling, and oozing are normal. Keep the area clean and moisturised.</Text>
              </View>
            </View>
            <View style={styles.stageRow}>
              <View style={styles.stageBadge}><Text style={styles.stageBadgeText}>2</Text></View>
              <View style={styles.stageContent}>
                <Text style={styles.stageLabel}>Days 4–14</Text>
                <Text style={styles.stageBody}>The tattoo will start to peel and flake. This is normal — do not pick or scratch it.</Text>
              </View>
            </View>
            <View style={styles.stageRow}>
              <View style={styles.stageBadge}><Text style={styles.stageBadgeText}>3</Text></View>
              <View style={styles.stageContent}>
                <Text style={styles.stageLabel}>Weeks 2–4</Text>
                <Text style={styles.stageBody}>The outer layer heals. The tattoo may look slightly dull — this is temporary. Full healing takes 4–6 weeks.</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitle}>Care instructions</Text>
              <View style={styles.sectionRule} />
            </View>
            <View style={styles.twoCol}>
              <View style={[styles.card, styles.doCard]}>
                <View style={styles.cardTitleRow}>
                  <CheckIcon />
                  <Text style={[styles.cardTitle, { color: '#15803d' }]}>Do</Text>
                </View>
                {DO_ITEMS.map((item) => (
                  <View style={styles.bullet} key={item}>
                    <CheckIcon />
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.card, styles.dontCard]}>
                <View style={styles.cardTitleRow}>
                  <CrossIcon />
                  <Text style={[styles.cardTitle, { color: '#b91c1c' }]}>Don&rsquo;t</Text>
                </View>
                {DONT_ITEMS.map((item) => (
                  <View style={styles.bullet} key={item}>
                    <CrossIcon />
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitle}>When to contact your artist</Text>
              <View style={styles.sectionRule} />
            </View>
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                If you notice excessive redness, swelling, pus, or a rash that lasts more than a few days,
                reach out to your artist or consult a healthcare professional. Minor issues during healing
                are normal, but it&rsquo;s always better to check.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>Provided by {artistName} via Inkquire</Text>
          <Text style={styles.footerContact}>Questions? {contactEmail}</Text>
        </View>
      </Page>
    </Document>
  )
}
