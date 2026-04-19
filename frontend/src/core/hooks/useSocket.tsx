import { io, Socket } from 'socket.io-client'
import { useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../core/store/store'

const useSocket = () => {
  const apiUrl = useSelector((state: RootState) => state.home.apiUrl)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const baseUrl = apiUrl.replace(/\/api$/, '')

    if (socketRef.current) {
      socketRef.current.disconnect()
    }

    socketRef.current = io(baseUrl, { transports: ['websocket'] })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [apiUrl])

  const send = (channel: string, message: string | object) => {
    if (socketRef.current) {
      socketRef.current.emit(channel, message)
    }
  }

  return { socket: socketRef.current as Socket, send }
}

export default useSocket
