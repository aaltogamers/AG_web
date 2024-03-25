interface Props {
  children: string
}

const SmallHeader = ({ children }: Props) => {
  return <h2 className="border-red border-b-4 px-8 pb-4 mb-8">{children}</h2>
}

export default SmallHeader
