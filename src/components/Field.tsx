/* eslint-disable jsx-a11y/label-has-associated-control */
import { SignupField } from '../types/types'

type Props = {
  field: SignupField
  saveAnswers?: (event: React.ChangeEvent<HTMLInputElement>) => void
}

const Field = ({ field, saveAnswers }: Props) => {
  const nameWithAsterisk = field.required ? `${field.name}*` : field.name

  const selectComponent = field.options && (
    <div>
      {field.options.map(({ option }) => (
        <div key={option}>
          <label className="text-xl">
            <input
              type="radio"
              name={field.name}
              className="mr-2"
              value={option}
              onChange={saveAnswers}
            />
            {option}
          </label>
        </div>
      ))}
    </div>
  )

  const textComponent = (
    <label>
      <input type="text" name={field.name} className="text-black" onChange={saveAnswers} />
    </label>
  )

  return (
    <div className="border-white border-solid border-2 p-4 my-4 rounded-lg">
      <h4 className="mb-4">{nameWithAsterisk}</h4>
      {field.type === 'select' ? selectComponent : textComponent}
    </div>
  )
}

export default Field
