interface Props {
  children: string
}

const Header = ({ children }: Props) => {
  return (
    <header className="mt-20 text-center flex flex-col items-center text-2xl ">
      <h1 className="border-red border-b-8 px-8 pb-8">{children}</h1>
    </header>
  )
}

export default Header
