import type { Metadata } from 'next'
import TaskBoard from '../../../components/tasks/TaskBoard'

type Props = {
  params: Promise<{ chatId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chatId } = await params
  return {
    title: `Tasks - ${chatId} | Aalto Gamers`,
  }
}

export default async function TaskBoardPage({ params }: Props) {
  const { chatId } = await params
  return <TaskBoard chatId={chatId} />
}
