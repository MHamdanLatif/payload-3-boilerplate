'use client'
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

type Linked = { schedules: number; financeLinked: boolean; deals?: string[]; blocked: string | null }
type Step = 'idle' | 'plain' | 'schedules' | 'finance'

/**
 * Asks the server what is linked before deleting, then walks through one prompt
 * per kind of linked record. Saved schedules are deleted with the lead; finance
 * deals never are, they only lose the link.
 */
export function DeleteLead({ id }: { id: number }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [linked, setLinked] = useState<Linked | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cancel = () => {
    setStep('idle')
    setLinked(null)
  }
  const start = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await fetch('/api/crm/leads/' + id, { cache: 'no-store' })
      const body = await result.json()
      if (!result.ok) throw Error(body.error || 'Could not check linked records.')
      if (body.blocked) throw Error(body.blocked)
      setLinked(body)
      setStep(body.schedules ? 'schedules' : body.financeLinked ? 'finance' : 'plain')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!linked) return
    setBusy(true)
    setError('')
    try {
      const result = await fetch('/api/crm/leads/' + id, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedules: linked.schedules,
          keepFinanceDeals: linked.financeLinked,
        }),
      })
      const body = await result.json()
      if (!result.ok) throw Error(body.error || 'Could not delete the lead.')
      router.replace('/leads-dashboard')
      router.refresh()
    } catch (error) {
      cancel()
      setError(error instanceof Error ? error.message : 'Check your connection and try again.')
      setBusy(false)
    }
  }
  const prompt = (text: ReactNode, confirm: string, next: () => void) => (
    <div role="alertdialog" aria-label="Delete lead" className="crm-panel mt-3 grid gap-3">
      <div className="text-sm">{text}</div>
      <div className="crm-grid">
        <button type="button" className="crm-button" disabled={busy} onClick={next}>
          {confirm}
        </button>
        <button type="button" className="crm-button secondary" disabled={busy} onClick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  )
  return (
    <section className="mt-8" aria-label="Delete lead">
      {step === 'idle' && (
        <button
          type="button"
          className="crm-button secondary text-[#a12f27]"
          disabled={busy}
          onClick={start}
        >
          Delete lead
        </button>
      )}
      {step === 'plain' && prompt('Delete this lead permanently?', 'Delete lead', remove)}
      {step === 'schedules' &&
        linked &&
        prompt(
          `This lead has ${linked.schedules} saved payment schedule${linked.schedules === 1 ? '' : 's'}. Deleting the lead also deletes ${linked.schedules === 1 ? 'it' : 'them'} permanently.`,
          'Delete lead and schedules',
          () => (linked.financeLinked ? setStep('finance') : remove()),
        )}
      {step === 'finance' &&
        linked &&
        prompt(
          <>
            <p>
              This lead is linked to a finance deal
              {linked.deals?.length ? ` (${linked.deals.join('; ')})` : ''}. Finance records are
              never deleted with a lead – the deal stays in Finance, just no longer linked to this
              lead.
            </p>
          </>,
          'Keep the deal and delete the lead',
          remove,
        )}
      {error && (
        <p className="crm-error mt-2" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
