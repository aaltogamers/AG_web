import type { GetServerSideProps } from 'next'
import AdminPage from '../../../components/AdminPage'
import PostSettings from '../../../components/posts/PostSettings'
import { AGEvent } from '../../../types/types'
import { getEvents } from '../../../utils/eventStore'

type Props = { events: AGEvent[] }

// Settings of scheduled posts: bots, review chat, approvers and channels
const PostSettingsPage = ({ events }: Props) => (
  <AdminPage events={events} section="posts">
    <PostSettings />
  </AdminPage>
)

export default PostSettingsPage

export const getServerSideProps: GetServerSideProps<Props> = async () => ({
  props: { events: await getEvents() },
})
