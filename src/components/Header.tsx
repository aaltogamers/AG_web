interface Props {
  children: string
}

const Header = ({ children }: Props) => {
  return (
    <header className="mt-20 text-center flex flex-col items-center text-2xl">
      <h2>{children}</h2>
      <span className="h-1 w-96 bg-red block" />
    </header>
  )
}

export default Header
