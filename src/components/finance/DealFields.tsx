'use client'
import { useState } from 'react'

export type FinanceProject = {
  id: number
  title: string
  unitTypes?:
    | {
        id?: string | null
        name?: string | null
        type: string
        price: number
        areaSqFt?: number | null
      }[]
    | null
}
export function DealFields({
  projects,
  initialProject = '',
}: {
  projects: FinanceProject[]
  initialProject?: string
}) {
  const [project, setProject] = useState(initialProject)
  const [unit, setUnit] = useState('')
  const [price, setPrice] = useState('')
  const units = projects.find((p) => String(p.id) === project)?.unitTypes || []
  const selected = units.find((u) => u.id === unit)
  return (
    <>
      <label>
        Project
        <select
          aria-label="Project"
          name="project"
          required
          value={project}
          onChange={(e) => {
            setProject(e.target.value)
            setUnit('')
            setPrice('')
          }}
        >
          <option value="">Select project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
          <option value="other">Other property / listing / brokerage</option>
        </select>
      </label>
      {project === 'other' && (
        <label>
          Property name or address
          <input name="otherProperty" required />
        </label>
      )}
      {project && project !== 'other' && units.length > 0 ? (
        <label>
          Unit type
          <select
            aria-label="Unit type"
            name="unitTypeKey"
            required
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value)
              setPrice(String(units.find((u) => u.id === e.target.value)?.price || ''))
            }}
          >
            <option value="">Select unit type</option>
            {units.map((u) => (
              <option key={u.id} value={u.id || ''}>
                {u.name ? `${u.name} · ${u.type}` : u.type}
                {u.areaSqFt ? ` · ${u.areaSqFt} sqft` : ''}
              </option>
            ))}
          </select>
          {selected?.areaSqFt && (
            <small>
              {selected.areaSqFt} sqft · {selected.type}
            </small>
          )}
        </label>
      ) : (
        project && (
          <label>
            Unit / property type
            <input
              name="unitType"
              required
              placeholder="e.g. 2-bedroom apartment or commercial plot"
            />
          </label>
        )
      )}
      <label>
        Unit number (optional)
        <input name="unitNumber" />
      </label>
      <label>
        Sale value (PKR)
        <input
          name="saleValue"
          type="number"
          min="0"
          step="0.01"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
    </>
  )
}
