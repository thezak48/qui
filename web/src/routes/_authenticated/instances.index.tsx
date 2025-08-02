import { createFileRoute } from '@tanstack/react-router'
import { Instances } from '@/pages/Instances'

export const Route = createFileRoute('/_authenticated/instances/')({
  component: Instances,
})