import { Document, Page, Text, View, StyleSheet, Svg, Path, Rect } from '@react-pdf/renderer'
import { MEDICAL_QUESTIONS, type MedicalAnswers } from '@/lib/consent/questions'

const GOLD = '#d4af37'
const INK = '#0a0a0a'

const styles = StyleSheet.create({
  page: { fontSize: 9.5, color: '#171717', fontFamily: 'Helvetica' },

  header: { backgroundColor: INK, paddingTop: 32, paddingBottom: 24, paddingHorizontal: 40 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD, marginRight: 6 },
  brand: { fontSize: 9, color: '#a3a3a3', letterSpacing: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 22, fontWeight: 700, color: '#ffffff' },
  subtitle: { fontSize: 10.5, color: '#d4d4d4', marginTop: 5 },
  signedBadge: { backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: GOLD, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8 },
  signedBadgeText: { fontSize: 8, color: GOLD, fontWeight: 700, letterSpacing: 0.5 },
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
  fieldValueBox: { borderBottom: '1pt solid #d4d4d4', paddingBottom: 3, minHeight: 16 },
  fieldValue: { fontSize: 10, color: '#171717', fontWeight: 700 },

  question: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, borderBottom: '0.5pt solid #f0f0f0' },
  questionText: { fontSize: 9.5, flex: 1, paddingRight: 8, color: '#262626' },
  answerPill: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10 },
  answerPillYes: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  answerPillNo: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  answerPillText: { fontSize: 8.5, fontWeight: 700 },

  consentBox: { backgroundColor: '#fafaf9', borderWidth: 1, borderColor: '#e7e5e4', borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 4, padding: 12 },
  consentText: { fontSize: 8.5, color: '#404040', lineHeight: 1.5 },

  signatureBlockOuter: { marginTop: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 16, flexDirection: 'row', justifyContent: 'space-between' },
  signatureCol: { flex: 1 },
  signatureLabel: { fontSize: 8, color: '#737373', marginBottom: 4 },
  signatureScript: { fontSize: 18, fontFamily: 'Helvetica-Oblique', color: '#171717' },
  signatureMeta: { fontSize: 8, color: '#737373', marginTop: 4 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: INK, paddingVertical: 12, paddingHorizontal: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerBrand: { fontSize: 8.5, color: '#a3a3a3' },
  footerContact: { fontSize: 8.5, color: '#a3a3a3' },
})

interface ConsentFormFilledDocumentProps {
  artistName: string
  studioName: string | null
  contactEmail: string
  clientName: string
  clientDob: string
  clientPhone: string | null
  tattooDescription: string
  medicalAnswers: MedicalAnswers
  signatureName: string
  signedAt: string
  ipAddress: string | null
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function CheckSquare() {
  return (
    <Svg width={11} height={11} viewBox="0 0 11 11">
      <Rect x={0.5} y={0.5} width={10} height={10} rx={2} fill={INK} />
      <Path d="M2.8 5.6l1.5 1.5L8.2 3.4" stroke={GOLD} strokeWidth={1.4} fill="none" />
    </Svg>
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

export function ConsentFormFilledDocument({
  artistName,
  studioName,
  contactEmail,
  clientName,
  clientDob,
  clientPhone,
  tattooDescription,
  medicalAnswers,
  signatureName,
  signedAt,
  ipAddress,
}: ConsentFormFilledDocumentProps) {
  return (
    <Document title={`Signed Consent Form — ${clientName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View>
              <View style={styles.brandRow}>
                <View style={styles.brandDot} />
                <Text style={styles.brand}>INKQUIRE</Text>
              </View>
              <Text style={styles.title}>Tattoo Consent Form</Text>
              <Text style={styles.subtitle}>
                {studioName ? `${artistName}  ·  ${studioName}` : artistName}
              </Text>
            </View>
            <View style={styles.signedBadge}>
              <Text style={styles.signedBadgeText}>SIGNED &amp; SUBMITTED</Text>
            </View>
          </View>
          <View style={styles.goldLine} />
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <SectionHead step={1} title="Client details" />
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Full name</Text>
                <View style={styles.fieldValueBox}><Text style={styles.fieldValue}>{clientName}</Text></View>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Date of birth</Text>
                <View style={styles.fieldValueBox}><Text style={styles.fieldValue}>{formatDate(clientDob)}</Text></View>
              </View>
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Date signed</Text>
                <View style={styles.fieldValueBox}><Text style={styles.fieldValue}>{formatDate(signedAt)}</Text></View>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Contact phone</Text>
                <View style={styles.fieldValueBox}><Text style={styles.fieldValue}>{clientPhone ?? '—'}</Text></View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHead step={2} title="Tattoo description" />
            <Text style={styles.fieldLabel}>Design, placement, and size</Text>
            <View style={[styles.fieldValueBox, { minHeight: 36 }]}>
              <Text style={{ fontSize: 9.5, color: '#262626', lineHeight: 1.4 }}>{tattooDescription}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHead step={3} title="Age confirmation" />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CheckSquare />
              <Text style={{ fontSize: 9, marginLeft: 6, color: '#262626' }}>I confirm that I am 18 years of age or older.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHead step={4} title="Medical disclosure" />
            {MEDICAL_QUESTIONS.map((q) => {
              const answer = medicalAnswers[q.id]
              const isYes = answer === 'yes'
              return (
                <View style={styles.question} key={q.id}>
                  <Text style={styles.questionText}>{q.text}</Text>
                  <View style={[styles.answerPill, isYes ? styles.answerPillYes : styles.answerPillNo]}>
                    <Text style={[styles.answerPillText, { color: isYes ? '#b91c1c' : '#15803d' }]}>
                      {isYes ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </View>
              )
            })}
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

          <View style={styles.signatureBlockOuter}>
            <View style={styles.signatureCol}>
              <Text style={styles.signatureLabel}>CLIENT SIGNATURE</Text>
              <Text style={styles.signatureScript}>{signatureName}</Text>
              <Text style={styles.signatureMeta}>Submitted {formatDateTime(signedAt)}{ipAddress ? `  ·  IP ${ipAddress}` : ''}</Text>
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
