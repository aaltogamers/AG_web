import Markdown from './Markdown'
import { HistoryEntry } from '../types/types'
import Header from './Header'
import BoardMember from './BoardMember'

interface Props {
  historyItems: HistoryEntry[]
}

const History = ({ historyItems }: Props) => {
  return (
    <div className="flex flex-col">
      <Header>AG - Over The Years</Header>

      <div className="grid grid-cols-[60px_40px_1fr] md:grid-cols-[100px_50px_1fr]">
        {historyItems.map((item, i) => (
          <>
            <div className="flex items-center" key={item.year}>
              <h3 className="font-bold">{item.year}</h3>
            </div>

            <div className="relative flex items-center" key={item.year + '-line'}>
              <div className="w-7 h-7 bg-white rounded-full" />
              <div
                className={`absolute bg-white left-3 bottom-0 w-1 top-0 ${i === 0 ? 'top-1/2' : ''} ${i === historyItems.length - 1 ? 'bottom-1/2' : ''}`}
              />
            </div>

            <div
              className={`flex flex-col justify-center pr-8 text-left py-10`}
              key={item.year + '-content'}
            >
              <h3 className="text-white">
                {item.year} {item?.title && `- ${item.title}`}
              </h3>
              {item?.content && (
                <span className="mb-4 text-gray-400">
                  <Markdown>{item.content}</Markdown>
                </span>
              )}
              <h5 className="text-white">Board of {item.year}</h5>
              <div className="grid grid-cols-2 md:grid-cols-5 w-fit gap-4 md:gap-6">
                {item.boardMembers.map(({ title, name, image }) => (
                  <div key={name} className="w-45 zoom-50 md:zoom-70">
                    <BoardMember
                      boardMember={{
                        title: title?.replace('of the Board', '').replace('Head of', ''),
                        name,
                        image,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        ))}
      </div>
    </div>
  )
}

export default History
