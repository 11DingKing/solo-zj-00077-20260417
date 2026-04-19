const useConfig = () => {
  /**
   * Get the backend url
   * @returns string
   */
  const getApiUrl = () => {
    const host = process.env.REACT_APP_BACKEND_HOST || 'localhost'
    const port = process.env.REACT_APP_BACKEND_PORT || '3001'
    const url = `https://${host}:${port}/api`
    return url
  }

  return { getApiUrl }
}

export default useConfig
