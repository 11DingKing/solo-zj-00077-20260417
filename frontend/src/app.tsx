import './app.scss'
import { useEffect, useRef } from 'react'
import { RootState } from './core/store/store'
import { useAppDispatch } from './core/hooks/useStore'
import { useSelector } from 'react-redux'
import { homeSlice } from './features/home'
import { authSlice } from './features/auth/auth'
import { toast } from 'react-toastify'
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import useConfig from './core/hooks/useConfig'
import Navigation from './common/navigation/navigation'
import Background from './common/background/background'
import Routing from './core/routing/routing'
import Notification from './common/notification/notification'
import useSocket from './core/hooks/useSocket'

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: unknown) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error)
    } else {
        promise.resolve(null)
    }
  })
  failedQueue = []
}

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  _skipTokenRefresh?: boolean
}

const TOKEN_REFRESH_ERROR_CODES = [1001, 1005, 1006, 1007, 1008]

function App() {
  const dispatch = useAppDispatch()
  const { apiUrl, theme } = useSelector((state: RootState) => state.home)

  const { getApiUrl } = useConfig()
  const { socket } = useSocket()

  const interceptorRegistered = useRef(false)

  useEffect(() => {
    if (interceptorRegistered.current) {
      return
    }
    interceptorRegistered.current = true

    axios.defaults.withCredentials = true
    axios.defaults.timeout = 5000

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosRequestConfig

        if (error.response?.status === 500) {
          console.error(error)
          toast.error('Something went wrong, please try again later!')
          return Promise.reject(error)
        }

        const isAuthError =
          error.response?.status === 401 ||
          (error.response?.status === 400 &&
            (error.response.data as any)?.error?.code &&
            TOKEN_REFRESH_ERROR_CODES.includes((error.response.data as any).error.code))

        if (!isAuthError) {
          return Promise.reject(error)
        }

        if (originalRequest._skipTokenRefresh) {
          dispatch(authSlice.actions.setUser({}))
          return Promise.reject(error)
        }

        if (originalRequest._retry) {
          dispatch(authSlice.actions.setUser({}))
          return Promise.reject(error)
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          })
            .then(() => {
              return axios(originalRequest)
            })
            .catch((err) => {
              return Promise.reject(err)
            })
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
          const refreshResponse = await axios.get(`${apiUrl}/auth/local/check`, {
            _skipTokenRefresh: true,
          } as CustomAxiosRequestConfig)
          const user = refreshResponse.data.result
          dispatch(authSlice.actions.setUser(user))
          processQueue(null)
          return axios(originalRequest)
        } catch (refreshError) {
          processQueue(refreshError)
          dispatch(authSlice.actions.setUser({}))
          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
      }
    )

    return () => {
      axios.interceptors.response.eject(interceptor)
      interceptorRegistered.current = false
    }
  }, [apiUrl, dispatch])

  useEffect(() => {
    const url = getApiUrl()
    dispatch(homeSlice.actions.setApiUrl(url))

    getUser()

    socket.on('connect', connectListener)
    socket.on('disconnected', disconnectListener)

    return () => {
      socket.off('connect', connectListener)
      socket.off('disconnected', disconnectListener)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const connectListener = () => {
    console.info('[SOCKET] Connected')
  }

  const disconnectListener = () => {
    console.info('[SOCKET] Disconnected')
  }

  const getUser = async () => {
    try {
      const response = await axios.get(`${apiUrl}/auth/local/check`)
      const user = response.data.result
      dispatch(authSlice.actions.setUser(user))
    } catch (err: any) {
      dispatch(authSlice.actions.setUser({}))
    }
  }

  return (
    <div className={`app-container ${theme}`}>
      <div className="app-content">
        <Background />
        <Navigation />
        <Routing />
        <Notification />
      </div>
    </div>
  )
}

export default App
