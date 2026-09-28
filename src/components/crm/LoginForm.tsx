'use client'
import { useState } from 'react'
export function LoginForm() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <form
      className="crm-panel crm-stack"
      onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        setError('')
        const body = Object.fromEntries(new FormData(event.currentTarget))
        try {
          const result = await fetch('/api/users/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!result.ok)
            throw Error(
              result.status === 429
                ? 'Too many attempts. Please try again shortly.'
                : 'Check your email and password.',
            )
          const next = new URLSearchParams(window.location.search).get('next') || '/leads-dashboard'
          const safe = next === '/leads-dashboard' || /^\/leads-dashboard[/?]/.test(next)
          window.location.assign(safe && !next.includes('\\') ? next : '/leads-dashboard')
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Could not sign in.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <label className="crm-label">
        Email
        <input className="crm-field" name="email" type="email" autoComplete="username" required />
      </label>
      <label className="crm-label">
        Password
        <input
          className="crm-field"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <p className="crm-muted">
        Stay signed in on this device for up to 30 days. Your session renews while you use the CRM.
      </p>
      {error && (
        <p role="alert" className="crm-error">
          {error}
        </p>
      )}
      <button className="crm-button" disabled={busy}>
        {busy ? 'Signing in...' : 'Sign in'}
      </button>
      <a className="crm-muted underline" href="/admin/forgot">
        Forgot password?
      </a>
    </form>
  )
}
