import { ScoreBoardEntry } from '../types/types'

type Top3Entry = ScoreBoardEntry & {
  place: string
  filter: string
  isTrophy?: boolean
}

const Top3Entry = ({ name, score, place, filter, isTrophy }: Top3Entry) => {
  const picture = isTrophy ? 'trophy.png' : 'crown.png'

  return (
    <div className="flex flex-col text-center text-2xl relative">
      <img
        src={picture}
        className="absolute left-[50%] translate-x-[-50%] top-[-5rem] h-20"
        style={{ filter }}
      />
      <span>{place}</span>
      <span>{name}</span>
      <span>{score} pt</span>
    </div>
  )
}

type Props = {
  entries: ScoreBoardEntry[]
  placeholderText: string
}

const Scoreboard = ({ entries, placeholderText }: Props) => {
  const sortedEntries = entries.sort((a, b) => b.score - a.score)
  const first = sortedEntries[0]
  const second = sortedEntries[1]
  const third = sortedEntries[2]
  const afterFirstThree = sortedEntries.slice(3)

  return (
    <>
      {entries.length >= 3 ? (
        <div className="flex justify-center">
          <div className="flex flex-col items-center mt-10">
            <div className="flex flex-col w-full pt-24">
              <Top3Entry
                name={first.name}
                score={first.score}
                place="1st"
                filter="invert(80%) sepia(79%) saturate(3927%) hue-rotate(357deg) brightness(98%) contrast(106%)"
              />
              <div className="grid grid-cols-2 gap-40">
                <Top3Entry
                  name={second.name}
                  score={second.score}
                  place="2nd"
                  filter="invert(96%) sepia(4%) saturate(956%) hue-rotate(173deg) brightness(84%) contrast(90%)"
                  isTrophy
                />
                <Top3Entry
                  name={third.name}
                  score={third.score}
                  place="3rd"
                  filter="invert(76%) sepia(24%) saturate(4772%) hue-rotate(335deg) brightness(84%) contrast(89%)"
                  isTrophy
                />
              </div>
            </div>
            <ol>
              <hr />
              {afterFirstThree.map(({ name, score }, index) => (
                <li key={name}>
                  <div className="text-2xl grid grid-cols-leaderboard w-full py-3 gap-10 md:gap-20 px-4">
                    <span>{index + 4}th</span>
                    <span className="break-words min-w-0">{name}</span>
                    <span className="text-right">{score} pt</span>
                  </div>
                  <hr />
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <p className="w-full text-center text-2xl mt-20">{placeholderText}</p>
      )}
    </>
  )
}

export default Scoreboard
