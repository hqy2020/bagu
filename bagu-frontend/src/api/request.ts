import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
  timeout: 60000, // AI 分析需要较长时间
})

export default request
