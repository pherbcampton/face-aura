export type Concern = {
  name: string
  level: 'low' | 'moderate' | 'high'
  score: number
  observation: string
}

export type RoutineStep = {
  order: number
  name: string
  instruction: string
  ingredient?: string
}

export type Product = {
  category: string
  name: string
  reason: string
  priceBand: '£' | '££' | '£££'
}

export type SkinAnalysis = {
  summary: string
  skinType: string
  skinTypeNote: string
  confidence: number
  concerns: Concern[]
  morningRoutine: RoutineStep[]
  eveningRoutine: RoutineStep[]
  products: Product[]
  nextCheckInDays: number
  safetyNote: string
  inference: 'gemma4' | 'demo'
  createdAt: string
}

export type ProgressEntry = {
  id: string
  date: string
  blemishes: number
  darkSpots: number
  hydration: number
}
