import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { formatPkr } from '@/lib/featured-projects'
import { DEFAULT_DISCLAIMER, type PlanResult } from '@/lib/payment-plan'

const COLORS = {
  brandDeep: '#2f3558',
  brandMid: '#3e4a89',
  gold: '#e3b04b',
  goldSoft: '#f3d488',
  ivory: '#fbf8f1',
  cream: '#f4eedf',
  textSoft: '#5c6271',
  white: '#ffffff',
  border: '#e5e0d2',
  loanNoteBg: '#fff8e6',
  loanNoteBorder: '#e3b04b',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 24,
    paddingHorizontal: 0,
    backgroundColor: COLORS.ivory,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: COLORS.brandDeep,
  },

  // ── Header band ──────────────────────────────────────────────
  headerBand: {
    backgroundColor: COLORS.brandDeep,
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lateefLogo: { width: 170, height: 64, objectFit: 'contain' },
  projectLogo: { maxWidth: 130, maxHeight: 64, objectFit: 'contain' },
  projectWordmark: {
    fontFamily: 'Times-Italic',
    fontSize: 16,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  goldRule: { height: 2, backgroundColor: COLORS.gold },

  // ── Title block ──────────────────────────────────────────────
  titleBlock: { paddingHorizontal: 36, paddingTop: 18, paddingBottom: 10 },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 2.5,
    color: COLORS.gold,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Times-Roman',
    fontSize: 20,
    color: COLORS.brandDeep,
    marginBottom: 4,
  },
  subtitle: { fontSize: 10, color: COLORS.textSoft, marginBottom: 10 },
  factsRow: { flexDirection: 'row', gap: 20, marginTop: 4 },
  fact: { flexDirection: 'column' },
  factLabel: {
    fontSize: 7,
    letterSpacing: 1.5,
    color: COLORS.textSoft,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  factValue: {
    fontFamily: 'Times-Roman',
    fontSize: 12,
    color: COLORS.brandDeep,
  },

  // ── Loan note ────────────────────────────────────────────────
  loanNote: {
    marginHorizontal: 36,
    marginTop: 8,
    padding: 9,
    backgroundColor: COLORS.loanNoteBg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.loanNoteBorder,
  },
  loanNoteText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: COLORS.brandDeep,
  },

  // ── Table ────────────────────────────────────────────────────
  table: { marginHorizontal: 36, marginTop: 10 },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: COLORS.brandDeep,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 3,
  },
  tableHeadCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: COLORS.white,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4.5,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  rowDown: { backgroundColor: COLORS.goldSoft },
  rowPossession: { backgroundColor: COLORS.cream },
  rowGrey: {},
  cellWhen: { width: '15%', fontSize: 8.5 },
  cellHead: { width: '45%', fontSize: 8.5, color: COLORS.brandDeep },
  cellAmount: { width: '22%', fontSize: 8.5, textAlign: 'right' },
  cellCumulative: { width: '18%', fontSize: 8.5, textAlign: 'right', color: COLORS.textSoft },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.brandDeep,
    backgroundColor: COLORS.ivory,
  },
  totalLabel: { width: '60%', fontFamily: 'Times-Roman', fontSize: 11 },
  totalAmount: { width: '22%', fontFamily: 'Times-Roman', fontSize: 11, textAlign: 'right' },
  totalPct: { width: '18%', fontFamily: 'Times-Roman', fontSize: 11, textAlign: 'right' },

  // ── Prep + disclaimer + footer ───────────────────────────────
  prep: {
    marginHorizontal: 36,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    fontSize: 8,
    color: COLORS.textSoft,
  },
  disclaimerWrap: {
    marginHorizontal: 36,
    marginTop: 10,
    padding: 9,
    backgroundColor: COLORS.white,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.gold,
  },
  disclaimerHead: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: COLORS.brandDeep,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  disclaimerText: { fontSize: 8, color: COLORS.textSoft, lineHeight: 1.5 },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: COLORS.textSoft,
  },
})

export type PaymentPlanPdfProps = {
  projectTitle: string
  projectLocation: string
  builderName: string
  selectedUnitType: string | null
  totalDurationMonths: number
  buyer: { name: string; phone: string }
  plan: PlanResult
  loanIncluded: boolean
  loanAmount: number
  lateefLogoUrl: string
  projectLogoUrl: string | null
  disclaimer: string
  generatedAt: string
}

export function PaymentPlanDocument(props: PaymentPlanPdfProps) {
  const {
    projectTitle,
    projectLocation,
    builderName,
    selectedUnitType,
    totalDurationMonths,
    buyer,
    plan,
    loanIncluded,
    loanAmount,
    lateefLogoUrl,
    projectLogoUrl,
    disclaimer,
    generatedAt,
  } = props

  // Active frequencies summary for the title-block facts row.
  const freqSummary =
    plan.cadence.activeFrequencies
      .map((f) => (f === 'HalfYearly' ? 'Half-Yearly' : f))
      .join(' + ') || 'None'

  return (
    <Document title={`Payment Plan — ${projectTitle}`} author="Lateef Properties">
      <Page size="A4" style={styles.page}>
        {/* ── Header band ───────────────────────────────────── */}
        <View style={styles.headerBand}>
          <Image src={lateefLogoUrl} style={styles.lateefLogo} />
          {projectLogoUrl ? (
            <Image src={projectLogoUrl} style={styles.projectLogo} />
          ) : (
            <Text style={styles.projectWordmark}>{projectTitle}</Text>
          )}
        </View>
        <View style={styles.goldRule} />

        {/* ── Title block ───────────────────────────────────── */}
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>PAYMENT PLAN</Text>
          <Text style={styles.title}>{projectTitle}</Text>
          <Text style={styles.subtitle}>
            {projectLocation} · By {builderName}
          </Text>

          <View style={styles.factsRow}>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>TOTAL PRICE</Text>
              <Text style={styles.factValue}>{formatPkr(plan.totals.effectivePrice)}</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>DURATION</Text>
              <Text style={styles.factValue}>{totalDurationMonths} months</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>INSTALLMENTS</Text>
              <Text style={styles.factValue}>{freqSummary}</Text>
            </View>
            {selectedUnitType ? (
              <View style={styles.fact}>
                <Text style={styles.factLabel}>UNIT TYPE</Text>
                <Text style={styles.factValue}>{selectedUnitType}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Loan note (conditional) ──────────────────────── */}
        {loanIncluded && loanAmount > 0 ? (
          <View style={styles.loanNote}>
            <Text style={styles.loanNoteText}>
              Expected Loan Component: {formatPkr(loanAmount)} — Payable after completion of grey
              structure.
            </Text>
          </View>
        ) : null}

        {/* ── Table ─────────────────────────────────────────── */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, styles.cellWhen]}>WHEN</Text>
            <Text style={[styles.tableHeadCell, styles.cellHead]}>HEAD</Text>
            <Text style={[styles.tableHeadCell, styles.cellAmount]}>AMOUNT</Text>
            <Text style={[styles.tableHeadCell, styles.cellCumulative]}>CUMULATIVE</Text>
          </View>
          {plan.rows.map((row, i) => (
            <View
              key={i}
              style={[
                styles.row,
                row.kind === 'down-payment'
                  ? styles.rowDown
                  : row.kind === 'possession'
                    ? styles.rowPossession
                    : styles.rowGrey,
              ]}
            >
              <Text style={styles.cellWhen}>{row.label}</Text>
              <Text style={styles.cellHead}>{row.headName}</Text>
              <Text style={styles.cellAmount}>{formatPkr(row.amount)}</Text>
              <Text style={styles.cellCumulative}>{row.cumulativePct}%</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatPkr(plan.totals.effectivePrice)}</Text>
            <Text style={styles.totalPct}>100%</Text>
          </View>
        </View>

        {/* ── Prepared for ─────────────────────────────────── */}
        <View style={styles.prep}>
          <Text>
            Prepared for {buyer.name} ({buyer.phone}) on {generatedAt}.
          </Text>
        </View>

        {/* ── Disclaimer ───────────────────────────────────── */}
        <View style={styles.disclaimerWrap}>
          <Text style={styles.disclaimerHead}>DISCLAIMER</Text>
          <Text style={styles.disclaimerText}>{disclaimer}</Text>
        </View>

        {/* ── Footer ───────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text>Lateef Properties · Karachi · WhatsApp 03363528333</Text>
          <Text>www.lateefproperties.com</Text>
        </View>
      </Page>
    </Document>
  )
}

export function composeDisclaimer(perProjectDisclaimer?: string | null): string {
  if (perProjectDisclaimer && perProjectDisclaimer.trim()) {
    return `${DEFAULT_DISCLAIMER}\n\n${perProjectDisclaimer.trim()}`
  }
  return DEFAULT_DISCLAIMER
}
