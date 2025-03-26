import { Request, Response } from 'express'
export interface Config {
  executablePath: string
  arguments: Record<string, string>
}

export interface Task {
  req?: Request
  res: Response
  tempImage1Path: string
  tempImage2Path: string
  requestId: number
}

export interface FaceMatchResponse {
  match: boolean
  distance: number
  requestId: number
}

export interface FaceMatchRequest {
  image1_url: string
  image2_url: string
}
