export type FlowStep = {
  id: string
  title: string
  description: string
  rank: string
  fields: FlowField[]
}

export type FlowField = {
  id: string
  label: string
  type: string
}

export type Flow = {
  id: string
  name: string
  description: string
  steps: FlowStep[]
}

export type FlowApiResponse = {
  success: true
  data: Flow
}

export type FlowListApiResponse = {
  success: true
  data: Flow[]
}
