import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import QuestionList from './pages/QuestionList'
import Practice from './pages/Practice'
import Profile from './pages/Profile'
import History from './pages/History'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/category/:categoryId" element={<QuestionList />} />
      <Route path="/practice/:questionId" element={<Practice />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/history" element={<History />} />
    </Routes>
  )
}
