import Header from './Header'

const History = () => {
  return (
    <div className="flex flex-col">
      <Header>History</Header>

      <div className="grid mt-20" style={{ gridTemplateColumns: '100px 50px 1fr' }}>
        {historyItems.map((item, i) => (
          <>
            <div className="flex items-center">
              <h3 className="font-bold">{item.year}</h3>
            </div>

            <div className="relative flex items-center py-10">
              <div className="w-7 h-7 bg-white rounded-full" />
              <div
                className={`absolute bg-white left-3 bottom-0 w-1 top-0 ${i === 0 ? 'top-1/2' : ''} ${i === historyItems.length - 1 ? 'bottom-1/2' : ''}`}
              />
            </div>

            <div className={`flex flex-col justify-center pr-8 text-left py-20`}>
              <h3 className="text-white">
                {item.year} {item?.title && `- ${item.title}`}
              </h3>
              {item?.description && <p className="mb-4 text-gray-400">{item.description}</p>}
              <h5 className="text-white">Board of {item.year}</h5>
              <div className="flex flex-row flex-wrap  gap-4">
                {item.boardMembers.map((member) => (
                  <div key={member.name} className="flex flex-col items-center">
                    <p className="text-gray-400">{member.name}</p>
                    <p className="text-gray-600">{member.position && `${member.position}`}</p>
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

const historyItems = [
  {
    year: '2016',
    title: 'Aalto Gamers is Founded',
    description:
      'Aalto Gamers ry was founded in the spring of 2016 by a group of gaming enthusiasts at Aalto University. The association aimed to create a vibrant community for gamers and promote gaming culture on campus.',
    boardMembers: [
      { name: 'Jukka Song', position: 'Chair' },
      { name: 'Tomas Järvinen', position: 'Vice Chair' },
      { name: 'Christian Danford', position: 'Treasurer' },
      { name: 'Karo Laine' },
      { name: 'Matti Parkkila' },
      { name: 'Panu Laasonen' },
      { name: 'Eino Virtanen' },
      { name: 'Henri Simola' },
      { name: 'Kristian Arjas' },
      { name: 'William Guo' },
    ],
  },
  {
    year: '2017',
    boardMembers: [
      { name: 'Karo Laine', position: 'Chair' },
      { name: 'Jukka Song', position: 'Vice Chair' },
      { name: 'Christian Danford', position: 'Treasurer' },
      { name: 'Henri Simola' },
      { name: 'Kristian Arjas' },
      { name: 'Panu Laasonen' },
      { name: 'Joel Jutila' },
      { name: 'Tomas Järvinen' },
      { name: 'Matti Parkkila' },
    ],
  },
  {
    year: '2018',
    boardMembers: [
      { name: 'Jukka Song', position: 'Chair' },
      { name: 'Karo Laine', position: 'Vice Chair' },
      { name: 'Christian Danford', position: 'Treasurer' },
      { name: 'Matti Parkkila' },
      { name: 'Juho Malmi' },
      { name: 'Santeri Suitiala' },
      { name: 'Aleksi Maunu' },
      { name: 'Van Chau' },
      { name: 'Joel Jutila' },
      { name: 'Kristian Arjas' },
    ],
  },
  {
    year: '2019',
    boardMembers: [
      { name: 'Santeri Suitiala', position: 'Chair' },
      { name: 'Kristian Arjas', position: 'Vice Chair' },
      { name: 'Joel Jutila', position: 'Treasurer' },
      { name: 'Jukka Song' },
      { name: 'Christian Danford' },
      { name: 'Jiaming Liang' },
      { name: 'Juho Malmi' },
      { name: 'Oskari Kuusinen' },
      { name: 'Viljami Sepponen' },
      { name: 'Karo Laine' },
    ],
  },
  {
    year: '2020',
    boardMembers: [
      { name: 'Jiaming Liang', position: 'Chair' },
      { name: 'Santeri Suitiala', position: 'Vice Chair' },
      { name: 'Joel Jutila', position: 'Treasurer' },
      { name: 'Riku Louhela' },
      { name: 'Jukka Song' },
    ],
  },
  {
    year: '2021',
    boardMembers: [
      { name: 'Anna Song', position: 'Chair' },
      { name: 'Viktor Musijenko', position: 'Vice Chair' },
      { name: 'Marcus Tanttu', position: 'Treasurer' },
      { name: 'Jiaming Liang' },
      { name: 'Lauri Ranta-Nilkku' },
      { name: 'Radovan Lamac' },
      { name: 'Niko Takko' },
      { name: 'Ilmari Tarpila' },
      { name: 'Juho Arjanne' },
    ],
  },
  {
    year: '2022',
    boardMembers: [
      { name: 'Anna Song', position: 'Chair' },
      { name: 'Viktor Musijenko', position: 'Vice Chair' },
      { name: 'Otto Hämäläinen', position: 'Treasurer' },
      { name: 'Lauri Ranta-Nilkku' },
      { name: 'Juho Arjanne' },
      { name: 'Tuukka Grönberg' },
      { name: 'Lenni Toikkanen' },
      { name: 'Jiaming Liang' },
      { name: 'Niko Takko' },
      { name: 'Marcus Tanttu' },
    ],
  },
  {
    year: '2023',
    boardMembers: [
      { name: 'Juho Arjanne', position: 'Chair' },
      { name: 'Otto Hämäläinen', position: 'Vice Chair' },
      { name: 'Noola Kaarna', position: 'Treasurer' },
      { name: 'Jiaming Liang' },
      { name: 'Lenni Toikkanen' },
      { name: 'Otto Söderman' },
      { name: 'Tuukka Grönberg' },
      { name: 'Mikko Sulamaa' },
    ],
  },
  {
    year: '2024',
    boardMembers: [
      { name: 'Otto Söderman', position: 'Chair' },
      { name: 'Mikko Sulamaa', position: 'Vice Chair' },
      { name: 'Noola Kaarna', position: 'Treasurer' },
      { name: 'Janni Lätti' },
      { name: 'Henrik Niskanen' },
      { name: 'Tuukka Grönberg' },
      { name: 'Kalle Jokipaltio' },
      { name: 'Laszlo Solyom' },
      { name: 'Juho Arjanne' },
      { name: 'Atte Räty' },
    ],
  },
  {
    year: '2025',
    boardMembers: [
      { name: 'Otto Söderman', position: 'Chair' },
      { name: 'Mikko Sulamaa', position: 'Vice Chair' },
      { name: 'Noola Kaarna', position: 'Treasurer' },
      { name: 'Kaisa Koivunen' },
      { name: 'Aleksanteri Roiha' },
      { name: 'Lenni Toikkanen' },
      { name: 'Janni Lätti' },
      { name: 'Atte Räty' },
      { name: 'Helena Päivöke' },
      { name: 'Sami Mairue' },
    ],
  },
  {
    year: '2026',
    boardMembers: [
      { name: 'Kalle Jokipaltio', position: 'Chair' },
      { name: 'Max Aksela', position: 'Vice Chair' },
      { name: 'Noola Kaarna', position: 'Treasurer' },
      { name: 'Otto Söderman' },
      { name: 'Veikka Innanen' },
      { name: 'Atte Räty' },
      { name: 'Helena Päivöke' },
      { name: 'Topias Seilonen' },
      { name: 'Sanzhar Zhakabayev' },
      { name: 'Imre Polik' },
    ],
  },
]

export default History
