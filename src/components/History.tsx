import Markdown from 'react-markdown'
import { HistoryEntry } from '../types/types'
import Header from './Header'
import BoardMember from './BoardMember'

interface Props {
  historyItems: HistoryEntry[]
}

const History = ({ historyItems }: Props) => {
  return (
    <div className="flex flex-col">
      <Header>AG Over the Years</Header>

      <div className="grid" style={{ gridTemplateColumns: '100px 50px 1fr' }}>
        {historyItems.map((item, i) => (
          <>
            <div className="flex items-center">
              <h3 className="font-bold">{item.year}</h3>
            </div>

            <div className="relative flex items-center">
              <div className="w-7 h-7 bg-white rounded-full" />
              <div
                className={`absolute bg-white left-3 bottom-0 w-1 top-0 ${i === 0 ? 'top-1/2' : ''} ${i === historyItems.length - 1 ? 'bottom-1/2' : ''}`}
              />
            </div>

            <div className={`flex flex-col justify-center pr-8 text-left py-10`}>
              <h3 className="text-white">
                {item.year} {item?.title && `- ${item.title}`}
              </h3>
              {item?.content && (
                <span className="mb-4 text-gray-400">
                  <Markdown>{item.content}</Markdown>
                </span>
              )}
              <h5 className="text-white">Board of {item.year}</h5>
              <div className="grid grid-cols-3 md:grid-cols-5 w-fit gap-6">
                {item.boardMembers.map(({ title, name, image }) => (
                  <div key={name} className="w-45" style={{ zoom: '0.7' }}>
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
