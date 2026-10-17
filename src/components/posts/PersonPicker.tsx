import type { TgUserOption } from '../../utils/social/postsClient'
import type { PostPerson } from '../../utils/social/types'

type Props = {
  value: PostPerson | null
  onChange: (person: PostPerson | null) => void
  // Users who have opened the task board
  users: TgUserOption[]
  disabled?: boolean
}

// A Telegram user who is responsible for something, reminded in the review topic
const PersonPicker = ({ value, onChange, users, disabled }: Props) => (
  <select
    className="p-2 rounded-md bg-white text-black w-full border border-gray-300"
    value={value?.id ?? ''}
    disabled={disabled}
    onChange={(e) => {
      const user = users.find((u) => u.id === e.target.value)
      onChange(user ? { id: user.id, name: user.name } : null)
    }}
  >
    <option value="">No one</option>
    {value && !users.some((u) => u.id === value.id) && <option value={value.id}>{value.name}</option>}
    {users.map((u) => (
      <option key={u.id} value={u.id}>
        {u.name}
        {u.username && ` @${u.username}`}
      </option>
    ))}
  </select>
)

export default PersonPicker
