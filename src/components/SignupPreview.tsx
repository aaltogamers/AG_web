// Tries out an unsaved sign-up form in the admin panel: the real sign-up dialog, and
// then how the sign-up would show up on the event page and in the admin table.
// Nothing is saved.
import { useMemo, useState } from 'react'
import type { SignupRow } from '../types/types'
import type { SignupTarget } from '../utils/eventUtils'
import { publicAnswers } from '../utils/signupAnswers'
import { resolvePoolId } from '../utils/signupPools'
import Dialog from './Dialog'
import ParticipantList from './ParticipantList'
import ParticipantTable from './ParticipantTable'
import SignupDialog from './SignupDialog'
import { draftInputs, FormDraft } from './SignupFormEditor'

const PREVIEW_ID = 'preview'

type Props = {
  target: SignupTarget
  draft: FormDraft
  // The real sign-ups, so places and the lists look like they would
  participants: SignupRow[]
  onClose: () => void
}

const SignupPreview = ({ target, draft, participants, onClose }: Props) => {
  const [previewRow, setPreviewRow] = useState<SignupRow | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(true)
  // Opens the dialog fresh, with the preview sign-up's answers
  const [formKey, setFormKey] = useState(0)

  const inputs = useMemo(() => draftInputs(draft), [draft])
  const pools = useMemo(
    () => draft.pools.map((p) => ({ ...p, name: p.name.trim() })),
    [draft.pools]
  )
  const rows = previewRow ? [...participants, previewRow] : participants
  const counts: Record<number, number> = Object.fromEntries(pools.map((p) => [p.id, 0]))
  rows.forEach((row) => {
    const id = resolvePoolId(pools, row.pool_id)
    counts[id] = (counts[id] ?? 0) + 1
  })
  const summary = {
    key: target.key,
    pools,
    openfrom: draft.openfrom,
    openuntil: draft.openuntil,
    inputs,
    counts,
  }
  const confirmed =
    draft.confirmedMessage || draft.confirmedLink
      ? { message: draft.confirmedMessage, link: draft.confirmedLink }
      : undefined

  const openForm = () => {
    setFormKey((k) => k + 1)
    setIsFormOpen(true)
  }

  if (isFormOpen) {
    return (
      <SignupDialog
        key={formKey}
        target={target}
        summary={summary}
        participants={rows}
        ownSignupId={previewRow ? PREVIEW_ID : null}
        confirmed={confirmed}
        onClose={() => (previewRow ? setIsFormOpen(false) : onClose())}
        preview={{
          save: (answers, poolId) =>
            setPreviewRow((old) => ({
              id: PREVIEW_ID,
              pool_id: poolId,
              // Editing keeps the place in line
              created_at: old?.created_at ?? new Date().toISOString(),
              answers,
            })),
          remove: () => setPreviewRow(null),
        }}
      />
    )
  }

  return (
    <Dialog
      onClose={onClose}
      title="Preview results"
      maxWidthClass="max-w-5xl"
      className="keep-dark"
    >
      <div className="text-lg text-lightgray">
        Nothing was saved. The preview sign-up is shown in red, together with the real sign-ups.
      </div>
      <div className="flex flex-wrap gap-4">
        <button type="button" className="mainbutton !text-lg !py-2 !px-6" onClick={openForm}>
          {previewRow ? 'Edit preview sign-up' : 'Sign up again'}
        </button>
        <button type="button" className="borderbutton !text-lg !py-2 !px-6" onClick={onClose}>
          Close preview
        </button>
      </div>
      <h4 className="mt-4">On the event page</h4>
      <ParticipantList
        participants={rows.map((row) => ({ ...row, answers: publicAnswers(row.answers, inputs) }))}
        pools={pools}
        inputs={inputs}
        ownSignupId={previewRow ? PREVIEW_ID : null}
      />
      <h4 className="mt-4">In the admin panel</h4>
      <ParticipantTable
        participants={rows}
        signupData={{ pools, inputs }}
        showPrivateData
        ownSignupId={previewRow ? PREVIEW_ID : null}
      />
    </Dialog>
  )
}

export default SignupPreview
