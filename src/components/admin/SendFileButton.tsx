'use client'

import React, { useState } from 'react'
import { Button, useDocumentInfo, toast } from '@payloadcms/ui'

/**
 * "Send File" — Privyr-style manual brochure send, on the lead's detail view.
 *
 * On click it: builds the lead's trackable brochure link, fills the editable
 * message template (CRM Settings global), and opens WhatsApp on the lead's chat
 * with the message pre-typed (wa.me deep link). The owner reviews and taps send
 * inside WhatsApp themselves — nothing is sent in the background, so there are
 * NO Meta per-message charges. The click is logged as "sent" on the lead.
 */
export const SendFileButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const [busy, setBusy] = useState(false)

  if (!id) {
    return (
      <div className="field-type">
        <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
          Save the lead first — the trackable brochure link is generated on save.
        </p>
      </div>
    )
  }

  const onClick = async () => {
    setBusy(true)
    try {
      // Fetch the saved lead (guarantees the generated brochureId + phone).
      const leadRes = await fetch(`/api/leads/${id}?depth=0`, { credentials: 'include' })
      if (!leadRes.ok) throw new Error('lead fetch failed')
      const lead = await leadRes.json()

      const phone = String(lead?.phone ?? '').replace(/\D/g, '')
      if (!phone) {
        toast.error('This lead has no phone number.')
        return
      }
      if (!lead?.brochureId) {
        toast.error('No brochure link on this lead yet — re-save to generate one.')
        return
      }

      // Editable message template from the CRM Settings global.
      let template = "Hi {name}, here's the {project} brochure: {link}"
      try {
        const gRes = await fetch('/api/globals/crm-settings?depth=0', { credentials: 'include' })
        if (gRes.ok) {
          const g = await gRes.json()
          if (g?.whatsappMessageTemplate) template = String(g.whatsappMessageTemplate)
        }
      } catch {
        /* fall back to the default template */
      }

      const firstName = String(lead?.name ?? '').split(' ')[0] || 'there'
      const project = lead?.sourceName || lead?.brochureHeadline || 'your'
      const link = `${window.location.origin}/brochure/${lead.brochureId}`
      const message = template
        .replaceAll('{name}', firstName)
        .replaceAll('{project}', String(project))
        .replaceAll('{link}', link)

      // Open WhatsApp on the lead's chat with the message pre-filled.
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')

      // Log the send (best-effort; doesn't block the user).
      void fetch(`/api/leads/${id}/log-send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link }),
      })

      toast.success('WhatsApp opened with the brochure message — review & tap send. Logged as sent.')
    } catch {
      toast.error('Could not prepare the WhatsApp message. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field-type" style={{ marginBottom: 8 }}>
      <Button buttonStyle="primary" onClick={onClick} disabled={busy}>
        {busy ? 'Preparing…' : '📄 Send brochure via WhatsApp'}
      </Button>
      <p style={{ fontSize: 12, opacity: 0.65, marginTop: 6, marginBottom: 0 }}>
        Opens WhatsApp with the message pre-typed. You tap send. Logs as “sent”; the open is tracked
        automatically.
      </p>
    </div>
  )
}
