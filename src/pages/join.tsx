import Link from 'next/link'
import Header from '../components/Header'
import { medias } from '../utils/contants'

const Join = () => {
  return (
    <div>
      <Header>Join us</Header>
      <h3 className="w-full text-center mt-10">Be a part of the coolest gaming community!</h3>
      <div className="w-full justify-center flex">
        <div className="grid grid-cols-3 gap-4 w-1/2">
          {medias.map(({ name, link, Icon }) => (
            <Link href={link} key={name} className="flex items-center justify-center">
              {name}
              <Icon size={80} className="m-4" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Join

/*
      <div id="main" className="wrapper style1">
        <div className="container">
          <section className="row aln-center">
            <Link href="http://tinyurl.com/joinaaltogamers" className="fas fa-gamepad fa-3x">
              Become a member
            </Link>
            <Link href="https://discord.gg/Ew7nGQqHgc" className="icon brands fa-discord fa-3x">
              Join our discord server
            </Link>
            <Link
              href="http://bit.do/aaltogamerslobby"
              className="icon brands big fa-telegram fa-3x"
            >
              Join our telegram group
            </Link>
          </section>
          <section className="row aln-center">
            <Link href="http://facebook.com/aaltogamers/" className="icon brands fa-facebook fa-3x">
              Find us on facebook
            </Link>

            <Link
              href="http://www.instagram.com/aaltogamers/"
              className="icon brands fa-instagram fa-3x"
            >
              Check out our instagram
            </Link>
            <Link
              href="http://twitch.tv/aaltogamers"
              id="twitch"
              className="icon brands fa-twitch fa-3x"
            >
              Catch us live on twitch
            </Link>
          </section>
        </div>
      </div>
      */
