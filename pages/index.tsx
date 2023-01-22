import Head from 'next/head'
import { Component } from 'react'
import { attributes, react as HomeContent } from '../content/home.md'

type Event = {
  name: string
  description: string
}

type Attributes = {
  title: string
  events: Event[]
}

export default class Home extends Component {
  render() {
    let { title, events } = attributes as Attributes
    return (
      <>
        <Head>
          <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
        </Head>
        <article>
          <h1>{title}</h1>
          <HomeContent />
          <ul>
            {events.map((event: Event, i: number) => (
              <li key={i}>
                <h2>{event.name}</h2>
                <p>{event.description}</p>
              </li>
            ))}
          </ul>
        </article>
      </>
    )
  }
}
