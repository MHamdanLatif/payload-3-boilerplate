import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { Report } from '@/lib/finance-reports'
import { exportValue } from '@/lib/finance-query'

const styles = StyleSheet.create({
  page: { padding: 32, paddingTop: 230, paddingBottom: 48, fontFamily: 'Helvetica', fontSize: 9, color: '#2f3558', backgroundColor: '#fbf8f1' },
  pageHeader: { position: 'absolute', top: 32, left: 32, right: 32 },
  header: { backgroundColor: '#2f3558', padding: 14, marginBottom: 14, borderBottomWidth: 2, borderBottomColor: '#e3b04b' },
  logo: { width: 120, height: 44, objectFit: 'contain' },
  brand: { color: '#ffffff', fontSize: 14 },
  title: { fontFamily: 'Times-Roman', fontSize: 21, marginBottom: 6 },
  note: { fontSize: 8, color: '#5c6271', marginBottom: 8, lineHeight: 1.4 },
  section: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginVertical: 12 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e0d2', backgroundColor: '#ffffff' },
  head: { backgroundColor: '#f4eedf', fontFamily: 'Helvetica-Bold' },
  cell: { padding: 6, fontSize: 9, lineHeight: 1.4 },
  record: { backgroundColor: '#ffffff', padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e5e0d2' },
  field: { fontSize: 9, marginBottom: 5, lineHeight: 1.4 },
  label: { fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 7, color: '#5c6271' },
})
const label = (key: string) => key.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())
const value = (key: string, input: unknown) => {
  const formatted = exportValue(key, input)
  return formatted == null || formatted === '' ? '-' : String(formatted)
}

/** Uses the CSV report's complete sections, with readable records for wide ledgers. */
export function ProjectReportDocument({ report, logo, generatedAt }: { report: Report; logo: Buffer | null; generatedAt: string }) {
  const metadata = report.sections[0]?.rows[0] ?? {}
  return (
    <Document title={`${metadata.project ?? 'Project'} - Finance report`} author="Lateef Properties">
      {report.sections.map((section, index) => {
        const columns = [...new Set(section.rows.flatMap((row) => Object.keys(row)))]
        return (
          <Page key={index} size="A4" style={styles.page}>
            <View fixed style={styles.pageHeader}>
              <View fixed style={styles.header}>
                {logo ? <Image fixed src={{ data: logo, format: 'png' }} style={styles.logo} /> : <Text fixed style={styles.brand}>Lateef Properties</Text>}
              </View>
              <Text fixed style={styles.title}>{String(metadata.project ?? 'Project finance report')}</Text>
              <Text fixed style={styles.note}>Project finance report | All monetary amounts in PKR{ '\n' }Period: {String(metadata.period_from ?? 'beginning')} to {String(metadata.period_to ?? '')} (Pakistan time){ '\n' }Generated: {generatedAt} PKT</Text>
              <Text fixed style={styles.section}>{section.title}</Text>
            </View>
              {columns.length > 0 && columns.length <= 6 && (
                <View fixed style={[styles.row, styles.head]}>
                  {columns.map((key) => <Text key={key} style={[styles.cell, { width: `${100 / columns.length}%` }]}>{label(key)}</Text>)}
                </View>
              )}
            {!section.rows.length && <Text style={styles.note}>No records</Text>}
            {section.rows.map((row, rowIndex) => columns.length > 6 ? (
              <View key={rowIndex} style={styles.record} wrap={Object.values(row).join('').length > 1200}>
                <Text style={[styles.label, styles.field]} minPresenceAhead={24}>Record {rowIndex + 1}</Text>
                {Object.entries(row).map(([key, input]) => (
                  <Text key={key} style={styles.field}><Text style={styles.label}>{label(key)}: </Text>{value(key, input)}</Text>
                ))}
              </View>
            ) : (
              <View key={rowIndex} style={styles.row} wrap={Object.values(row).join('').length > 1200}>
                {columns.map((key) => <Text key={key} style={[styles.cell, { width: `${100 / columns.length}%` }]}>{value(key, row[key])}</Text>)}
              </View>
            ))}
            <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `Confidential - Finance | Current rules and linked deal commissions; activity and funding balances use the period above. | ${pageNumber} / ${totalPages}`} />
          </Page>
        )
      })}
    </Document>
  )
}
