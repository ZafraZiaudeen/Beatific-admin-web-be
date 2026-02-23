export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
}

export interface AuthPayload {
  id: string
  email: string
  name: string
  role: string
}

export interface AuthResponse {
  _id: string
  name: string
  email: string
  role: string
  token: string
}
