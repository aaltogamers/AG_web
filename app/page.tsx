import { attributes, react as HomeContent } from '../content/home.md'

type Event = {
  name: string
  description: string
}

type Attributes = {
  title: string
  events: Event[]
}

const Home = () => {
  const { title, events } = attributes as Attributes
  return (
    <article>
      <h1>{title}</h1>
      <HomeContent />
      <ul>
        {events.map((event: Event) => (
          <li key={event.name}>
            <h2>{event.name}</h2>
            <p>{event.description}</p>
          </li>
        ))}
      </ul>
    </article>
  )
}

export default Home
