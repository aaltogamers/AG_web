import { useState } from 'react'
import PageWrapper from '../components/PageWrapper'
import Header from '../components/Header'
import { SubmitHandler, useForm } from 'react-hook-form'
import Input from '../components/Input'

type Inputs = {
  username: string
}

export default function WhitelistPage() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, control } = useForm<Inputs>()

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true)
    setStatus('')

    try {
      const res = await fetch('/api/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: data.username }),
      })
      const responseData = await res.json()

      if (res.ok) {
        setStatus(`${responseData.message}`)
      } else {
        setStatus(`Error: ${responseData.error}`)
      }
    } catch (err) {
      setStatus(`Error: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <Header>AG Minecraft Server Whitelist</Header>
      <div className="flex justify-center mt-8">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col items-center max-w-90 text-xl"
        >
          <Input
            control={control}
            register={register}
            name="username"
            defaultValue=""
            displayName="Your Minecraft username"
            type="text"
          />

          <button type="submit" className="mainbutton" disabled={loading}>
            {loading ? 'Whitelisting...' : 'Add me to the whitelist!'}
          </button>

          {status && <div className="mt-4 text-lg">{status}</div>}
        </form>
      </div>
    </PageWrapper>
  )
}
