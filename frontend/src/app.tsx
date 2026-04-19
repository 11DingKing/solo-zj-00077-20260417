import './app.scss'
import { useEffect } from 'react'
import { RootState } from './core/store/store'
import { useAppDispatch } from './core/hooks/useStore'
import { useSelector } from 'react-redux'
import { homeSlice } from './features/home'
import { authSlice } from './features/auth/auth'
import { toast } from 'react-toastify'
import axios from 'axios'
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

function App() {
  const dispatch = useAppDispatch()
  const { apiUrl, theme } = useSelector((state: RootState) => state.home)

  const { getApiUrl } = useConfig()
  const { socket } = useSocket()

  // Send cookies with every request
  axios.defaults.withCredentials = true
  // Set default request timeout to 5s
  axios.defaults.timeout = 5000

  // Request error handling middleware with token refresh
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config

      if (error.response?.status === 500) {
        console.error(error)
        toast.error('Something went wrong, please try again later!')
        return Promise.reject(error)
      }

      if (error.response?.status === 401 || error.response?.status === 400) {
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
          const refreshResponse = await axios.get(`${apiUrl}/auth/local/check`)
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

      return Promise.reject(error)
    }
  )

  useEffect(() => {
    // Set backend url
    const url = getApiUrl()
    dispatch(homeSlice.actions.setApiUrl(url))

    // Get essential data from server
    getUser()

    // Listen for socket.io connection messages
    socket.on('connect', connectListener)
    socket.on('disconnected', disconnectListener)

    // The socket.io the listeners must be removed
    // In order to prevent multiple event registrations
    // https://socket.io/how-to/use-with-react-hooks
    return () => {
      socket.off('connect', connectListener)
      socket.off('disconnected', disconnectListener)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Socket.io connected event
   */
  const connectListener = () => {
    console.info('[SOCKET] Connected')
  }

  /**
   * Socket.io disconnected event
   */
  const disconnectListener = () => {
    console.info('[SOCKET] Disconnected')
  }

  /**
   * Get user data
   * @returns object
   */
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
