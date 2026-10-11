import Select from 'react-select'
import type { DiscordRoleOption } from '../../utils/social/postsClient'

type Option = { value: string; label: string }

type Props = {
  // 'here', 'everyone' or role ids
  value: string[]
  onChange: (value: string[]) => void
  // null while loading or when they can't be loaded
  roles: DiscordRoleOption[] | null
}

// Who a Discord message pings: @here, @everyone and the server's roles
const DiscordPingsPicker = ({ value, onChange, roles }: Props) => {
  const options: Option[] = [
    { value: 'here', label: '@here' },
    { value: 'everyone', label: '@everyone' },
    ...(roles ?? []).map((r) => ({ value: r.id, label: `@${r.name}` })),
  ]
  // Roles that couldn't be loaded or no longer exist are shown by id
  const selected = value.map((v) => options.find((o) => o.value === v) ?? { value: v, label: `role ${v}` })
  return (
    <Select
      isMulti
      value={selected}
      onChange={(picked) => onChange(picked.map((o) => o.value))}
      options={options}
      isLoading={!roles}
      placeholder="No pings"
      noOptionsMessage={() => 'No such role'}
      className="text-black"
      theme={(theme) => ({
        ...theme,
        colors: { ...theme.colors, primary25: 'lightgray', primary: 'red' },
      })}
    />
  )
}

export default DiscordPingsPicker
