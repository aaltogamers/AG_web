const makeBackgroundInvisible = () => {
  const bodyElem = document.querySelector('body')
  const htmlElem = document.querySelector('html')
  if (bodyElem && htmlElem) {
    bodyElem.style.backgroundColor = 'transparent'
    htmlElem.style.backgroundColor = 'transparent'
  }
}
export default makeBackgroundInvisible
