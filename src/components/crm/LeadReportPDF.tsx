import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { Counts, SourceRow } from '@/lib/lead-report-groups'

/**
 * Investor-facing leads report.
 *
 * Aggregates only: no lead names, phone numbers or notes. This document is
 * made to be forwarded outside the company, so it carries nothing about any
 * individual buyer.
 */

const COLORS = {
  brandDeep: '#2f3558',
  gold: '#e3b04b',
  ivory: '#fbf8f1',
  cream: '#f4eedf',
  textSoft: '#5c6271',
  white: '#ffffff',
  border: '#e5e0d2',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 44,
    backgroundColor: COLORS.ivory,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: COLORS.brandDeep,
  },
  headerBand: {
    backgroundColor: COLORS.brandDeep,
    paddingHorizontal: 36,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: { width: 150, height: 56, objectFit: 'contain' },
  headerRight: { alignItems: 'flex-end' },
  headerEyebrow: {
    fontSize: 7,
    letterSpacing: 2,
    color: COLORS.gold,
    fontFamily: 'Helvetica-Bold',
  },
  headerDate: { fontSize: 8, color: COLORS.white, marginTop: 4 },
  goldRule: { height: 2, backgroundColor: COLORS.gold },
  body: { paddingHorizontal: 36, paddingTop: 18 },
  title: { fontFamily: 'Times-Roman', fontSize: 22 },
  subtitle: { fontSize: 10, color: COLORS.textSoft, marginTop: 4 },
  filters: { fontSize: 8, color: COLORS.textSoft, marginTop: 3 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, marginHorizontal: -4 },
  kpi: {
    width: '25%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  kpiInner: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: {
    fontSize: 6.5,
    letterSpacing: 1.2,
    color: COLORS.textSoft,
    fontFamily: 'Helvetica-Bold',
  },
  kpiValue: { fontFamily: 'Times-Roman', fontSize: 16, marginTop: 3 },
  kpiSub: { fontSize: 7, color: COLORS.textSoft, marginTop: 1 },
  sectionTitle: { fontFamily: 'Times-Roman', fontSize: 14, marginTop: 14, marginBottom: 4 },
  sectionNote: { fontSize: 7.5, color: COLORS.textSoft, marginBottom: 6 },
  table: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  headRow: { flexDirection: 'row', backgroundColor: COLORS.brandDeep },
  headCell: {
    color: COLORS.white,
    fontSize: 6.5,
    letterSpacing: 0.4,
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  row: { flexDirection: 'row', borderTopWidth: 1, borderColor: COLORS.border },
  channelRow: { backgroundColor: COLORS.cream },
  cell: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 8 },
  bold: { fontFamily: 'Helvetica-Bold' },
  empty: { padding: 8, fontSize: 8, color: COLORS.textSoft },
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

const NUM_COLS = ['Leads', 'Contacted', 'Qualified', 'Site visits', 'Closed won', 'Qualify rate']
// Wide enough that no header ("SITE VISITS") has to hyphenate.
const LABEL_W = '34%'
const NUM_W = '11%'
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '0%')

function CountsTable({
  first,
  rows,
}: {
  first: string
  rows: { label: string; depth?: number; counts: Counts }[]
}) {
  return (
    <View style={styles.table}>
      <View style={styles.headRow} fixed>
        <Text style={[styles.headCell, { width: LABEL_W }]}>{first.toUpperCase()}</Text>
        {NUM_COLS.map((c) => (
          <Text key={c} style={[styles.headCell, { width: NUM_W, textAlign: 'right' }]}>
            {c.toUpperCase()}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => {
        const depth = r.depth ?? 0
        const top = r.depth === 0
        const c = r.counts
        return (
          <View key={i} style={top ? [styles.row, styles.channelRow] : styles.row} wrap={false}>
            <Text
              style={[styles.cell, { width: LABEL_W, paddingLeft: 5 + depth * 10 }, top ? styles.bold : {}]}
            >
              {depth > 0 ? '› ' : ''}
              {r.label}
            </Text>
            {[c.leads, c.contacted, c.qualified, c.siteVisits, c.closedWon].map((n, j) => (
              <Text
                key={j}
                style={[styles.cell, { width: NUM_W, textAlign: 'right' }, top ? styles.bold : {}]}
              >
                {n}
              </Text>
            ))}
            <Text style={[styles.cell, { width: NUM_W, textAlign: 'right' }, top ? styles.bold : {}]}>
              {pct(c.qualified, c.leads)}
            </Text>
          </View>
        )
      })}
      {!rows.length && <Text style={styles.empty}>No leads in this period.</Text>}
    </View>
  )
}

export type LeadReportPdfProps = {
  logo: Buffer | null
  projectLabel: string
  period: string
  filters: string[]
  generatedAt: string
  totals: Counts
  openedBrochure: number
  avgTimeOnPage: string
  byProject: { label: string; counts: Counts }[] | null
  bySource: SourceRow[]
}

export function LeadReportDocument(p: LeadReportPdfProps) {
  const t = p.totals
  const kpis = [
    { label: 'TOTAL LEADS', value: String(t.leads) },
    { label: 'CONTACTED', value: String(t.contacted), sub: pct(t.contacted, t.leads) },
    { label: 'QUALIFIED', value: String(t.qualified), sub: pct(t.qualified, t.leads) },
    { label: 'SITE VISITS', value: String(t.siteVisits), sub: pct(t.siteVisits, t.leads) },
    { label: 'CLOSED WON', value: String(t.closedWon), sub: pct(t.closedWon, t.leads) },
    { label: 'INVALID / JUNK', value: String(t.junk), sub: pct(t.junk, t.leads) },
    { label: 'OPENED BROCHURE', value: String(p.openedBrochure), sub: pct(p.openedBrochure, t.leads) },
    { label: 'AVG TIME ON BROCHURE', value: p.avgTimeOnPage || '—' },
  ]
  return (
    <Document title={`Lead report — ${p.projectLabel}`} author="Lateef Properties">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          {p.logo ? <Image src={{ data: p.logo, format: 'png' }} style={styles.logo} /> : <Text />}
          <View style={styles.headerRight}>
            <Text style={styles.headerEyebrow}>LEAD REPORT</Text>
            <Text style={styles.headerDate}>Generated {p.generatedAt} PKT</Text>
          </View>
        </View>
        <View style={styles.goldRule} />
        <View style={styles.body}>
          <Text style={styles.title}>{p.projectLabel}</Text>
          <Text style={styles.subtitle}>{p.period}</Text>
          {p.filters.length > 0 && <Text style={styles.filters}>{p.filters.join(' · ')}</Text>}

          <View style={styles.kpis}>
            {kpis.map((k) => (
              <View key={k.label} style={styles.kpi}>
                <View style={styles.kpiInner}>
                  <Text style={styles.kpiLabel}>{k.label}</Text>
                  <Text style={styles.kpiValue}>{k.value}</Text>
                  {k.sub ? <Text style={styles.kpiSub}>{k.sub} of leads</Text> : null}
                </View>
              </View>
            ))}
          </View>

          {p.byProject && (
            <>
              <Text style={styles.sectionTitle}>By project</Text>
              <CountsTable first="Project" rows={p.byProject} />
            </>
          )}

          <Text style={styles.sectionTitle} minPresenceAhead={60}>
            By source
          </Text>
          <Text style={styles.sectionNote}>
            Meta paid ads are broken down by campaign, then ad set, then ad.
          </Text>
          <CountsTable first="Source" rows={p.bySource} />
        </View>
        <View style={styles.footer} fixed>
          <Text>Lateef Properties · Confidential</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
