interface Props {
  children: string
  // Space above the title
  className?: string
}

const Header = ({ children, className = 'mt-20' }: Props) => {
  return (
    <header className={`${className} text-center flex flex-col items-center text-2xl`}>
      <h1 className="border-red border-b-8 px-8 pb-8">{children}</h1>
    </header>
  )
}

export default Header
