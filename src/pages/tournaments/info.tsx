import Head from 'next/head'
import Header from '../../components/Header'
import Markdown from '../../components/Markdown'
import PageWrapper from '../../components/PageWrapper'

const content = `
## Reading the bracket

- The bracket updates live as organizers enter results. No need to refresh.
- The small number next to a match is its match number. The organizers use it when calling teams.
- A match marked with the Twitch logo is the one being streamed.
- **BYE** means a free round: the team advances without playing.
- Match length is Bo1 unless the round header says otherwise (e.g. *Final Bo3*).

## Challengermode tournaments

Some tournaments are run on Challengermode. Their bracket here is updated from Challengermode a few seconds after results are reported there, and the rules and seeding are Challengermode's. Swiss standings may order tied teams differently than Challengermode, but the teams that advanced are always shown on top. Follow the "View on Challengermode" link for details.

## Seeding

Teams are seeded by expected skill (seed 1 = strongest). Good seeds meet weaker teams first.

## Double Elimination with 4-team Final

- You're out after **two** losses. Your first loss drops you from the upper bracket to the lower bracket.
- The 4 teams left (2 from the upper bracket, 2 from the lower bracket) play a single elimination final: semi-finals (upper vs lower), then the final.

## Swiss → Single Elimination

- **Swiss stage:** everyone plays a fixed number of rounds (e.g. 3, all Bo1). No one is knocked out during it.
- Round 1: the top half of seeds plays the bottom half (e.g. with 16 teams: 1st vs 9th, 2nd vs 10th, etc.).
- After that, you play a team with the same record (e.g. 1–0 vs 1–0), never the same team twice.
- With an odd number of teams, one team gets a BYE each round, which counts as a win.
- **Standings:** wins, then Buchholz (the total wins of all your opponents, so beating strong teams helps), then round difference (rounds won minus rounds lost), then seed.
- **Playoffs:** the top teams (e.g. 16) go to a single elimination bracket, seeded by standings (1st vs 16th, etc.). One loss and you're out. The final can be longer (e.g. Bo3).
`

const TournamentInfoPage = () => (
  <PageWrapper>
    <Head>
      <title>How tournaments work - Aalto Gamers</title>
    </Head>
    <div className="flex justify-center">
      <div className="flex flex-col md:w-3/4 items-center">
        <Header>How tournaments work</Header>
        <div className="my-12 w-full">
          <Markdown>{content}</Markdown>
        </div>
      </div>
    </div>
  </PageWrapper>
)

export default TournamentInfoPage
