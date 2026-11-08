'use client'

import { useState } from 'react'
import { Button, toast, useDocumentInfo, useFormModified } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

export function CreateMarketingPageButton() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      const response = await fetch(`/api/featured-projects/${id}/marketing-page`, {
        method: 'POST', credentials: 'include',
      })
      if (!response.ok) throw new Error('Could not create the marketing page. Please try again.')
      const result = await response.json()
      router.push(`/admin/collections/marketed-projects/${result.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the marketing page.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field-type">
      <Button onClick={create} disabled={!id || modified || busy}>
        {busy ? 'Opening marketing page…' : 'Create marketing page'}
      </Button>
      <p>Copies saved information into an editable, offline marketing page. If a linked page already exists, opens it without overwriting your edits.</p>
      {(!id || modified) && <p>Save this project first to include your latest changes.</p>}
    </div>
  )
}
