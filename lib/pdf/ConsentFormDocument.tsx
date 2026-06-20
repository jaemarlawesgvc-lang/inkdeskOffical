import { Document, Page, Text, View, StyleSheet, Svg, Rect } from '@react-pdf/renderer'

const GOLD = '#d4af37'
const INK = '#0a0a0a'

const styles = StyleSheet.create({
  page: { fontSize: 9.5, color: '#171717', fontFamily: 'Helvetica' },

  header: { backgroundColor: INK, paddingTop: 32, paddingBottom: 24, paddingHorizontal: 40 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD, marginRight: 6 },
  brand: { fontSize: 9, color: '#a3a3a3', letterSpacing: 2 },
  title: { fontSize: 22, fontWeight: 700, color: '#ffffff' },
  subtitle: { fontSize: 10.5, color: '#d4d4d4', marginTop: 5 },
  goldLine: { height: 2, backgroundColor: GOLD, width: 48, marginTop: 14 },

  body: { padding: 40, paddingTop: 24, paddingBottom: 56 },

  section: { marginBottom: 16 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  stepBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  stepBadgeText: { fontSize: 8, fontWeight: 700, color: GOLD },
  sectionTitle: { fontSize: 11.5, fontWeight: 700, color: '#171717' },
  sectionRule: { flex: 1, height: 1, backgroundColor: '#e5e5e5', marginLeft: 10 },

  fieldRow: { flexDirection: 'row', marginBottom: 9, gap: 12 },
  field: { flex: 1 },
  fieldLabel: { fontSize: 8.5, color: '#737373', marginBottom: 3 },
  fieldLine: { borderBottom: '1pt solid #a3a3a3', height: 18 },

  question: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, borderBottom: '0.5pt solid #f0f0f0' },
  questionText: { fontSize: 9.5, flex: 1, paddingRight: 8, color: '#262626' },
  checkboxRow: { flexDirection: 'row', gap: 14 },
  checkboxLabelRow: { flexDirection: 'row', alignItems: 'center' },
  checkboxLabel: { fontSize: 8.5, marginLeft: 4, color: '#525252' },

  consentBox: { backgroundColor: '#fafaf9', borderWidth: 1, borderColor: '#e7e5e4', borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 4, padding: 12 },
  consentText: { fontSize: 8.5, color: '#404040', lineHeight: 1.5 },

  signatureRow: { flexDirection: 'row', gap: 24, marginTop: 20 },
  signatureBlock: { flex: 1 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: INK, paddingVertical: 12, paddingHorizontal: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerBrand: { fontSize: 8.5, color: '#a3a3a3' },
  footerContact: { fontSize: 8.5, color: '#a3a3a3' },
})

interface ConsentFormDocumentProps {
  artistName: string
  studioName: string | null
  contactEmail: string
}

const MEDICAL_QUESTIONS = [
  'Are you currently taking blood thinners or anticoagulant medication?',
  'Do you have any skin conditions (eczema, psoriasis, keloid scarring, etc.)?',
  'Are you currently pregnant or breastfeeding?',
  'Do you have diabetes, epilepsy, or a heart condition?',
  'Are you allergic to latex, lidocaine, or tattoo pigments?',
  'Have you consumed alcohol or recreational drugs in the last 24 hours?',
]

function Checkbox({ label }: { label: string }) {
  return (
    <View style={styles.checkboxLabelRow}>
      <Svg width={11} height={11} viewBox="0 0 11 11">
        <Rect x={0.5} y={0.5} width={10} height={10} rx={2} stroke="#737373" strokeWidth={1} fill="#ffffff" />
      </Svg>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </View>
  )
}

function SectionHead({ step, title }: { step: number; title: string }) {
  return (
    <View style={styles.sectionHeadRow}>
      <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{step}</Text></View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRule} />
    </View>
  )
}

export function ConsentFormDocument({ artistName, studioName, contactEmail }: ConsentFormDocumentProps) {
  return (
    <Document title={`Consent Form — ${artistName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brand}>INKQUIRE</Text>
          </View>
          <Text style={styles.title}>Tattoo Consent Form</Text>
          <Text style={styles.subtitle}>
            {studioName ? `${artistName}  ·  ${studioName}` : artistName}
          </Text>
          <View style={styles.goldLine} />
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <SectionHead step={1} title="Client details" />
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Full name</Text>
                <View style={styles.fieldLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Date of birth</Text>
                <View style={styles.fieldLine} />
              </View>
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Date</Text>
                <View style={styles.fieldLine} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Contact phone</Text>
                <View style={styles.fieldLine} />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHead step={2} title="Tattoo description" />
            <Text style={styles.fieldLabel}>Design, placement, and size</Text>
            <View style={[styles.fieldLine, { height: 40 }]} />
          </View>

          <View style={styles.section}>
            <SectionHead step={3} title="Age confirmation" />
            <Checkbox label="I confirm that I am 18 years of age or older." />
          </View>

          <View style={styles.section}>
            <SectionHead step={4} title="Medical disclosure" />
            {MEDICAL_QUESTIONS.map((q) => (
              <View style={styles.question} key={q}>
                <Text style={styles.questionText}>{q}</Text>
                <View style={styles.checkboxRow}>
                  <Checkbox label="Yes" />
                  <Checkbox label="No" />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <SectionHead step={5} title="Consent statement" />
            <View style={styles.consentBox}>
              <Text style={styles.consentText}>
                I understand that tattooing is a permanent procedure that carries inherent risks, including but not
                limited to infection, allergic reaction, and scarring. I have disclosed all relevant medical
                information above to the best of my knowledge. I consent to receive the tattoo described, release
                {studioName ? ` ${studioName} and ` : ' '}{artistName} from liability for risks inherent to the
                tattooing process when performed with reasonable care, and confirm I have received aftercare
                instructions.
              </Text>
            </View>
          </View>

          <View style={styles.signatureRow}>
            <View style={styles.signatureBlock}>
              <Text style={styles.fieldLabel}>Client signature</Text>
              <View style={styles.fieldLine} />
            </View>
            <View style={styles.signatureBlock}>
              <Text style={styles.fieldLabel}>Date</Text>
              <View style={styles.fieldLine} />
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
