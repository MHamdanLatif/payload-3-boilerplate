'use client'

import { useMemo, useState } from 'react'
import {
  computeAdminPlan,
  initialAdminPlan,
  validateAdminPlan,
  type AdminPlanInput,
  type AdminHead,
  type StudioProject,
} from '@/lib/admin-payment-plan'
import { formatPlanMoney } from '@/lib/payment-plan'

const field =
  'mt-1 w-full rounded-lg border border-brand-deep/20 bg-white px-3 py-2 text-sm text-brand-deep'
const button =
  'rounded-lg border border-brand-deep/20 bg-white px-4 py-2 text-sm hover:bg-cream disabled:opacity-50'
const panel = 'rounded-2xl border border-brand-deep/10 bg-white p-5 shadow-sm md:p-7'
function Numeric({
  label,
  value,
  onChange,
  ...props
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className="block text-xs font-medium">
      {label}
      <input
        className={field}
        aria-label={label}
        type="number"
        min={0}
        step={0.01}
        {...props}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      />
    </label>
  )
}

export function PaymentPlanStudio({ projects }: { projects: StudioProject[] }) {
  const [projectId, setProjectId] = useState('')
  const [input, setInput] = useState<AdminPlanInput | null>(null)
  const [buyer, setBuyer] = useState({ name: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const project = projects.find((p) => String(p.id) === projectId)
  const result = useMemo(() => {
    if (!input) return null
    const errors = validateAdminPlan(input)
    return errors.length ? { errors, value: null } : { errors: [], value: computeAdminPlan(input) }
  }, [input])
  const warnings = [...(result?.errors ?? []), ...(result?.value?.plan.warnings ?? [])]
  const change = (patch: Partial<AdminPlanInput>) => {
    setInput((p) => (p ? { ...p, ...patch } : p))
    setError('')
  }
  const changeHead = (id: string, patch: Partial<AdminHead>) =>
    change({ heads: input!.heads.map((h) => (h.id === id ? { ...h, ...patch } : h)) })
  const canReplace = () =>
    !input ||
    window.confirm('Load a different project or unit? This replaces the current unsaved plan.')
  async function download() {
    if (!input || warnings.length) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/payment-plan/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: input, buyer }),
      })
      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.error || 'Could not export the plan.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `Lateef-${project?.slug ?? 'project'}-Custom-PaymentPlan.pdf`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export the plan.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <a href="/admin" className="text-sm underline">
        ← Admin dashboard
      </a>
      <div className="my-8">
        <p className="text-xs uppercase tracking-[0.25em] text-brand-deep/60">
          Lateef Properties · Admin only
        </p>
        <h1 className="mt-2 font-serif text-4xl">Payment Plan Studio</h1>
        <p className="mt-3 max-w-3xl text-sm text-brand-deep/70">
          Set the negotiated price, edit the payments, and export a branded plan. This draft stays
          in this tab until you leave or reload.
        </p>
      </div>
      <fieldset disabled={busy} className="min-w-0 space-y-6">
        <section className={panel}>
          <h2 className="mb-4 text-lg font-semibold">1. Project &amp; unit</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-xs font-medium">
              Project
              <select
                aria-label="Project"
                className={field}
                value={projectId}
                onChange={(e) => {
                  if (canReplace()) {
                    setProjectId(e.target.value)
                    setInput(null)
                    setError('')
                  }
                }}
              >
                <option value="">Choose a featured project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              Unit
              <select
                aria-label="Unit"
                disabled={!project}
                className={field}
                value={input?.unitId ?? ''}
                onChange={(e) => {
                  if (canReplace()) {
                    setInput(e.target.value ? initialAdminPlan(project!, e.target.value) : null)
                    setError('')
                  }
                }}
              >
                <option value="">Choose a unit</option>
                {project?.unitTypes?.map((u) => (
                  <option key={u.id} value={u.id!}>
                    {u.name ? `${u.name} — ` : ''}
                    {u.type} · {formatPlanMoney(u.price)}
                  </option>
                ))}
              </select>
            </label>
            {input && (
              <Numeric
                label="Duration (months)"
                step={1}
                min={1}
                max={120}
                value={input.duration}
                onChange={(duration) => change({ duration })}
              />
            )}
          </div>
          {project && !project.unitTypes?.length && (
            <p className="mt-3 text-sm">
              Add unit types to this featured project in the CMS first.
            </p>
          )}
        </section>
        {input && (
          <>
            <section className={panel}>
              <h2 className="mb-4 text-lg font-semibold">2. Negotiated price</h2>
              <div className="max-w-sm">
                <Numeric
                  label="Base unit price (PKR)"
                  value={input.basePrice}
                  onChange={(basePrice) => change({ basePrice })}
                />
              </div>
              <h3 className="mt-6 font-medium">Extra charges</h3>
              <p className="mt-1 text-xs text-brand-deep/65">
                Separate payments add to the final total once and leave the regular schedule
                unchanged. Month 0 means at signing.
              </p>
              {input.charges.map((c, i) => (
                <div
                  key={c.id}
                  className="mt-3 grid items-end gap-3 rounded-xl bg-cream/50 p-3 md:grid-cols-5"
                >
                  <label className="text-xs">
                    Charge name
                    <input
                      aria-label={`Charge ${i + 1} name`}
                      className={field}
                      value={c.name}
                      onChange={(e) =>
                        change({
                          charges: input.charges.map((x) =>
                            x.id === c.id ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <Numeric
                    label={`Charge ${i + 1} amount (PKR)`}
                    value={c.amount}
                    onChange={(amount) =>
                      change({
                        charges: input.charges.map((x) => (x.id === c.id ? { ...x, amount } : x)),
                      })
                    }
                  />
                  <label className="text-xs">
                    Payment treatment
                    <select
                      aria-label={`Charge ${i + 1} treatment`}
                      className={field}
                      value={c.separate ? 'separate' : 'regular'}
                      onChange={(e) =>
                        change({
                          charges: input.charges.map((x) =>
                            x.id === c.id ? { ...x, separate: e.target.value === 'separate' } : x,
                          ),
                        })
                      }
                    >
                      <option value="regular">In regular schedule</option>
                      <option value="separate">Separate payment</option>
                    </select>
                  </label>
                  {c.separate ? (
                    <Numeric
                      label={`Charge ${i + 1} due month`}
                      step={1}
                      max={240}
                      value={c.month}
                      onChange={(month) =>
                        change({
                          charges: input.charges.map((x) => (x.id === c.id ? { ...x, month } : x)),
                        })
                      }
                    />
                  ) : (
                    <span className="text-xs text-brand-deep/60">
                      Included in the balance to allocate
                    </span>
                  )}
                  <button
                    type="button"
                    className={button}
                    onClick={() => change({ charges: input.charges.filter((x) => x.id !== c.id) })}
                  >
                    Remove charge
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={`${button} mt-3`}
                onClick={() =>
                  change({
                    charges: [
                      ...input.charges,
                      {
                        id: crypto.randomUUID(),
                        name: 'Extra charge',
                        amount: 0,
                        separate: false,
                        month: 6,
                      },
                    ],
                  })
                }
              >
                Add extra charge
              </button>
              <h3 className="mt-6 font-medium">Discounts</h3>
              {input.discounts.map((d, i) => (
                <div key={d.id} className="mt-3 grid items-end gap-3 md:grid-cols-3">
                  <label className="text-xs">
                    Discount name
                    <input
                      aria-label={`Discount ${i + 1} name`}
                      className={field}
                      value={d.name}
                      onChange={(e) =>
                        change({
                          discounts: input.discounts.map((x) =>
                            x.id === d.id ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <Numeric
                    label={`Discount ${i + 1} amount (PKR)`}
                    value={d.amount}
                    onChange={(amount) =>
                      change({
                        discounts: input.discounts.map((x) =>
                          x.id === d.id ? { ...x, amount } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className={button}
                    onClick={() =>
                      change({ discounts: input.discounts.filter((x) => x.id !== d.id) })
                    }
                  >
                    Remove discount
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={`${button} mt-3`}
                onClick={() =>
                  change({
                    discounts: [
                      ...input.discounts,
                      { id: crypto.randomUUID(), name: 'Discount', amount: 0 },
                    ],
                  })
                }
              >
                Add discount
              </button>
              {result?.value && (
                <div className="mt-6 grid gap-3 rounded-xl bg-brand-deep p-5 text-white md:grid-cols-2">
                  <div>
                    <p className="text-xs">Final payable price</p>
                    <p data-testid="final-price" className="mt-1 text-2xl">
                      {formatPlanMoney(result.value.finalPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs">Regular schedule, excluding separate charges</p>
                    <p data-testid="regular-price" className="mt-1 text-2xl">
                      {formatPlanMoney(result.value.regularPrice)}
                    </p>
                  </div>
                </div>
              )}
            </section>
            <section className={panel}>
              <h2 className="text-lg font-semibold">3. Payment heads</h2>
              <p className="mt-2 text-sm text-brand-deep/65">
                Enter amounts per payment. Choose “Calculate for me” on the payments that should
                share the remainder equally. Entered amounts stay unchanged. Edit timing below
                independently of the duration label; milestone month 0 means on completion.
              </p>
              {input.heads.map((h, i) => (
                <div
                  key={h.id}
                  className="mt-4 rounded-xl border border-brand-deep/15 p-4"
                  data-testid="payment-head"
                >
                  <div className="grid items-end gap-3 md:grid-cols-4">
                    <label className="text-xs">
                      Head name
                      <input
                        aria-label={`Head ${i + 1} name`}
                        className={field}
                        value={h.name}
                        onChange={(e) => changeHead(h.id, { name: e.target.value })}
                      />
                    </label>
                    <label className="text-xs">
                      Type
                      <select
                        aria-label={`Head ${i + 1} type`}
                        className={field}
                        value={h.kind}
                        onChange={(e) =>
                          changeHead(h.id, { kind: e.target.value as AdminHead['kind'] })
                        }
                      >
                        <option value="down-payment">Down payment</option>
                        <option value="installment">Installment</option>
                        <option value="milestone">Milestone</option>
                        <option value="possession">Possession</option>
                      </select>
                    </label>
                    <label className="text-xs">
                      Amount method
                      <select
                        aria-label={`Head ${i + 1} amount method`}
                        className={field}
                        value={h.method}
                        onChange={(e) => {
                          const row = result?.value?.plan.rows.find((r) => r.sourceId === h.id)
                          changeHead(h.id, {
                            method: e.target.value as AdminHead['method'],
                            amount: row?.amount ?? h.amount,
                          })
                        }}
                      >
                        <option value="entered">Enter an amount</option>
                        <option value="calculated">Calculate for me</option>
                      </select>
                    </label>
                    {h.method === 'entered' ? (
                      <Numeric
                        label={`Head ${i + 1} amount (PKR)`}
                        value={h.amount}
                        onChange={(amount) => changeHead(h.id, { amount })}
                      />
                    ) : (
                      <div className="pb-2 text-sm">
                        <span className="block text-xs text-brand-deep/60">
                          Calculated per payment
                        </span>
                        {formatPlanMoney(
                          result?.value?.plan.rows.find((r) => r.sourceId === h.id)?.amount ?? 0,
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 grid items-end gap-3 md:grid-cols-4">
                    <Numeric
                      label={`Head ${i + 1} payment count`}
                      min={1}
                      max={120}
                      step={1}
                      value={h.count}
                      onChange={(count) => changeHead(h.id, { count })}
                    />
                    <Numeric
                      label={`Head ${i + 1} first month`}
                      max={240}
                      step={1}
                      value={h.firstMonth}
                      onChange={(firstMonth) => changeHead(h.id, { firstMonth })}
                    />
                    <Numeric
                      label={`Head ${i + 1} repeat every (months)`}
                      max={240}
                      step={1}
                      value={h.intervalMonths}
                      onChange={(intervalMonths) => changeHead(h.id, { intervalMonths })}
                    />
                    <button
                      type="button"
                      className={button}
                      onClick={() => change({ heads: input.heads.filter((x) => x.id !== h.id) })}
                    >
                      Remove head
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className={`${button} mt-4`}
                onClick={() =>
                  change({
                    heads: [
                      ...input.heads,
                      {
                        id: crypto.randomUUID(),
                        name: 'Additional payment',
                        kind: 'milestone',
                        method: 'entered',
                        amount: 0,
                        count: 1,
                        firstMonth: 0,
                        intervalMonths: 0,
                      },
                    ],
                  })
                }
              >
                Add payment head
              </button>
            </section>
            <section className={panel}>
              <h2 className="text-lg font-semibold">4. Review &amp; export</h2>
              {warnings.length > 0 && (
                <ul
                  role="alert"
                  className="my-4 list-disc rounded-lg bg-red-50 p-5 pl-8 text-sm text-red-800"
                >
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              {result?.value && (
                <>
                  <div className="my-4 flex flex-wrap gap-6 text-sm">
                    <span>
                      Allocated: <strong>{formatPlanMoney(result.value.allocated)}</strong>
                    </span>
                    <span>
                      Remaining:{' '}
                      <strong data-testid="remaining">
                        {formatPlanMoney(result.value.remaining)}
                      </strong>
                    </span>
                  </div>
                  <div className="max-h-[500px] overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-cream">
                        <tr>
                          <th className="p-3">When</th>
                          <th className="p-3">Payment</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3 text-right">Cumulative</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.value.plan.rows.map((r, i) => (
                          <tr key={i} className="border-b border-brand-deep/10">
                            <td className="p-3">{r.label}</td>
                            <td className="p-3">{r.headName}</td>
                            <td className="whitespace-nowrap p-3 text-right">
                              {formatPlanMoney(r.amount)}
                            </td>
                            <td className="p-3 text-right">{r.cumulativePct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-xs">
                  Prepared for (optional)
                  <input
                    className={field}
                    value={buyer.name}
                    maxLength={120}
                    onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
                  />
                </label>
                <label className="text-xs">
                  Contact (optional)
                  <input
                    className={field}
                    value={buyer.phone}
                    maxLength={60}
                    onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })}
                  />
                </label>
              </div>
              <p className="mt-3 text-xs text-brand-deep/60">
                Calculated payments can differ by one paisa to make the total exact. Exporting does
                not create a marketing lead.
              </p>
              {error && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={download}
                disabled={busy || warnings.length > 0 || !result?.value}
                className="mt-5 rounded-lg bg-brand-deep px-6 py-3 font-medium text-white disabled:opacity-50"
              >
                {busy ? 'Preparing PDF…' : 'Export branded PDF'}
              </button>
            </section>
          </>
        )}
      </fieldset>
    </main>
  )
}
