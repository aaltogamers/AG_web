import type { GetStaticProps } from 'next'
import AdminPage from '../../../components/AdminPage'
import PostSettings from '../../../components/posts/PostSettings'
import { AGEvent } from '../../../types/types'
import { getEvents } from '../../../utils/fileUtils'

type Props = { events: AGEvent[] }

// Settings of scheduled posts: bots, review chat, approvers and channels
const PostSettingsPage = ({ events }: Props) => (
  <AdminPage events={events} section="posts">
    <PostSettings />
  </AdminPage>
)

export default PostSettingsPage

export const getStaticProps: GetStaticProps<Props> = () => ({ props: { events: getEvents() } })
