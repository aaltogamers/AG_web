declare module '*.md' {
  const attributes: { [key: string]: string | string[] | {}[] }
  const react: React.FC<attributes>
  export { attributes, react }
}
