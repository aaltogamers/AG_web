import { useForm, SubmitHandler } from 'react-hook-form'
import Input from './Input'
import { loginAdmin } from '../utils/adminAuth'

type Inputs = {
  password: string
}

type Props = {
  onLoggedIn: () => void
}

const AdminLoginForm = ({ onLoggedIn }: Props) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    control,
  } = useForm<Inputs>()

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    const ok = await loginAdmin(data.password)
    if (!ok) {
      setError('password', { type: 'manual', message: 'Wrong password' })
      return
    }
    onLoggedIn()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center">
      <Input
        control={control}
        register={register}
        name="password"
        defaultValue=""
        displayName="AG Admin password"
        type="password"
      />
      {errors.password && <p className="text-red">{errors.password.message}</p>}
      <input type="submit" className="text-white p-4 text-2xl hover:cursor-pointer" />
    </form>
  )
}

export default AdminLoginForm
