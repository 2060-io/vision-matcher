import { Config } from './interfaces'

const config: Config = {
  executablePath: './face_matcher/bin/face_matcher',
  arguments: {
    face_detector_path: 'haarcascade_frontalface_default.xml',
    face_matcher_model_path: './face_matcher_model.onnx',
    distance_algorithm: 'cosine',
    distance_threshold: '0.4',
    allow_multi_face: 'false',
  },
}

export default config
