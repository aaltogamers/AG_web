import { FirebaseApp } from 'firebase/app'
import { addDoc, collection, getFirestore } from 'firebase/firestore'
import { useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { Poll } from '../types/types'
import Input from './Input'

type Props = {
  app: FirebaseApp
}

type CreatableBet = Omit<Poll, 'id'>

const BetCreateForm = ({ app }: Props) => {
  const [isFormVisible, setIsFormVisible] = useState(false)
  const { register, handleSubmit, control, reset } = useForm()
  const db = getFirestore(app)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit: SubmitHandler<any> = async (data) => {
    const options = data.options.split(',').map((option: string) => option.trim())
    const newBet: CreatableBet = {
      question: data.question,
      options,
      isVotable: false,
      isVisible: false,
      additionalMessage: data.additionalMessage,
      creationTimeStamp: Date.now(),
    }
    await addDoc(collection(db, 'polls'), newBet)
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
/*  const [options, setOptions] = useState<string[]>([])
  const [newOption, setNewOption] = useState<string>('')
  const [question, setQuestion] = useState<string>('')
    <div>
      <input value={question} onChange={(e) => setQuestion(e.target.value)}></input>
      <input value={newOption} onChange={(e) => setNewOption(e.target.value)}></input>
      <button onClick={() => setOptions([...options, newOption])}>Add option</button>
      {options.map((option) => (
        <div key={option}>
          <span>{option}</span>
          <button onClick={() => setOptions(options.filter((o) => o !== option))}>X</button>
        </div>
      ))}
    </div>
    */
