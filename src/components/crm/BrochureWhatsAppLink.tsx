'use client'

import { useEffect, useState } from 'react'
import { whatsappSendUrl } from '@/lib/brochure-message'

export function BrochureWhatsAppLink({
  id,
  phone,
  message,
  link,
}: {
  id: number
  phone: string
  message: string
  link: string
}) {
  const [userAgent, setUserAgent] = useState('')
  const [logFailed, setLogFailed] = useState(false)
  useEffect(() => setUserAgent(navigator.userAgent), [])
  const android = /Android/i.test(userAgent)
  return (
    <>
      <a
        className="crm-button col-span-2"
        href={whatsappSendUrl(phone, message, userAgent)}
        target={android ? undefined : '_blank'}
        rel="noopener noreferrer"
        onClick={() => {
          // Do not await logging: Chrome needs the app launch directly on the tap.
          // Keepalive allows this request to finish after the browser leaves.
          setLogFailed(false)
          void fetch(`/api/leads/${id}/log-send`, {
            method: 'POST',
            credentials: 'include',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link }),
          })
            .then((response) => {
              if (!response.ok) setLogFailed(true)
            })
            .catch(() => setLogFailed(true))
        }}
      >
        Prepare brochure in WhatsApp
      </a>
      {logFailed && (
        <p role="alert" className="crm-muted col-span-2">
          Could not record the brochure action. Check the lead status after sending.
        </p>
      )}
    </>
  )
}
