import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import HomeFeed from './pages/HomeFeed'
import Explore from './pages/Explore'
import Notifications from './pages/Notifications'
import Messages from './pages/Messages'
import Bookmarks from './pages/Bookmarks'
import Profile from './pages/Profile'
import PostDetail from './pages/PostDetail'
import AdminPanel from './pages/AdminPanel'
import './App.css'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomeFeed />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:username" element={<Profile />} />
        <Route path="/post/:id" element={<PostDetail />} />
      </Route>
    </Routes>
  )
}

export default App
