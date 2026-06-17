import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#171717', fontFamily: 'Helvetica' },
  header: { marginBottom: 20, borderBottom: '2pt solid #171717', paddingBottom: 12 },
  brand: { fontSize: 10, color: '#737373', marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700 },
  subtitle: { fontSize: 11, color: '#525252', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', marginBottom: 10, gap: 12 },
  field: { flex: 1 },
  fieldLabel: { fontSize: 9, color: '#737373', marginBottom: 3 },
  fieldLine: { borderBottom: '1pt solid #a3a3a3', height: 18 },
  question: { marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' },
  questionText: { fontSize: 10, flex: 1, paddingRight: 8 },
  checkboxRow: { flexDirection: 'row', gap: 16 },
  checkbox: { width: 10, height: 10, border: '1pt solid #525252', marginRight: 4 },
  checkboxLabel: { fontSize: 9, flexDirection: 'row', alignItems: 'center' },
  consentText: { fontSize: 9, color: '#404040', lineHeight: 1.5, marginBottom: 12 },
  signatureRow: { flexDirection: 'row', gap: 24, marginTop: 24 },
  signatureBlock: { flex: 1 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: '1pt solid #e5e5e5', paddingTop: 10, fontSize: 9, color: '#a3a3a3', textAlign: 'center' },
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
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={styles.checkbox} />
      <Text style={{ fontSize: 9 }}>{label}</Text>
    </View>
  )
}

export function ConsentFormDocument({ artistName, studioName, contactEmail }: ConsentFormDocumentProps) {
  return (
    <Document title={`Consent Form — ${artistName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>InkDesk</Text>
          <Text style={styles.title}>Tattoo Consent Form</Text>
          <Text style={styles.subtitle}>
            {studioName ? `${artistName} · ${studioName}` : artistName}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client details</Text>
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
          <Text style={styles.sectionTitle}>Tattoo description</Text>
          <Text style={styles.fieldLabel}>Design, placement, and size</Text>
          <View style={[styles.fieldLine, { height: 40 }]} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Age confirmation</Text>
          <Checkbox label="I confirm that I am 18 years of age or older." />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical disclosure</Text>
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
          <Text style={styles.sectionTitle}>Consent statement</Text>
          <Text style={styles.consentText}>
            I understand that tattooing is a permanent procedure that carries inherent risks, including but not
            limited to infection, allergic reaction, and scarring. I have disclosed all relevant medical
            information above to the best of my knowledge. I consent to receive the tattoo described, release
            {studioName ? ` ${studioName} and ` : ' '}{artistName} from liability for risks inherent to the
            tattooing process when performed with reasonable care, and confirm I have received aftercare
            instructions.
          </Text>
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

        <Text style={styles.footer}>
          Provided by {artistName} via InkDesk · Questions? Contact {contactEmail}
        </Text>
      </Page>
    </Document>
  )
}
