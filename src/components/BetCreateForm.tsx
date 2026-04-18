import { useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import Input from './Input'

const BetCreateForm = () => {
  const [isFormVisible, setIsFormVisible] = useState(false)
  const { register, handleSubmit, control, reset } = useForm()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit: SubmitHandler<any> = async (data) => {
    const options = (data.options as string)
      .split(',')
      .map((option: string) => option.trim())
      .filter((option) => option.length > 0)

    const res = await fetch('/api/polls', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        question: data.question,
        options,
        additionalMessage: data.additionalMessage,
      }),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      alert(`Failed to create bet: ${err.error ?? res.status}`)
      return
    }
    setIsFormVisible(false)
    reset()
  }

  return (
    <div className="border-white border-2 relative">
      {isFormVisible ? (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col my-6 mx-12">
          <Input
            register={register}
            name="question"
            displayName="Question"
            placeHolder="Who will win, A or B?"
            type="text"
            required
            control={control}
          />
          <Input
            register={register}
            name="options"
            displayName="Options"
            placeHolder="Option1, Option2"
            type="text"
            required
            control={control}
          />
          <Input
            register={register}
            name="additionalMessage"
            displayName="Additional Chat Message"
            defaultValue="The betting will be open for the first 4 rounds of the match."
            type="text"
            control={control}
          />
          <button type="submit" className="mainbutton ml-4 ">
            Add new Bet
          </button>
          <button
            className="absolute top-0 right-1 text-xl p-2"
            onClick={() => setIsFormVisible(false)}
          >
            ✖
          </button>
        </form>
      ) : (
        <button className="w-80 h-80 m-4 text-9xl" onClick={() => setIsFormVisible(true)}>
          +
        </button>
      )}
    </div>
  )
}

export default BetCreateForm
