/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useSearchParams, useLocation } from "react-router-dom";
import React, { useState, useEffect, createContext, useContext, useRef } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "motion/react";
import { Camera, Video, Plus, User, LogOut, Image as ImageIcon, Home as HomeIcon, Search, Trash2, X } from "lucide-react";

// --- Types & Auth Context ---

interface User {
  id: number;
  username: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = (userData: User) => setUser(userData);
  const logout = () => {
    fetch("/api/auth/logout", { method: "POST" }).then(() => setUser(null));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// --- Components ---

function VideoPlayer({ src }: { src: string }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedProgress = x / rect.width;
    videoRef.current.currentTime = clickedProgress * videoRef.current.duration;
  };

  return (
    <div 
      className="relative w-full h-full overflow-hidden group/video"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video 
        ref={videoRef}
        className="w-full h-full object-cover grayscale group-hover/video:grayscale-0 transition-all duration-1000 scale-105 group-hover/video:scale-100"
        onTimeUpdate={handleTimeUpdate}
        muted={isMuted}
        autoPlay
        loop
        playsInline
      >
        <source src={src} />
        Your browser does not support the video tag.
      </video>

      {/* Overlay controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6"
          >
            {/* Play Button Big */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.button 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={togglePlay}
                className="bg-white text-black p-6 rounded-full hover:scale-110 transition-transform cursor-pointer"
              >
                {isPlaying ? <LogOut className="rotate-90 w-8 h-8 fill-black" /> : <Plus className="rotate-45 w-8 h-8 fill-black" />}
              </motion.button>
            </div>

            {/* Bottom Bar */}
            <div className="space-y-4">
              <div 
                className="h-1 bg-white/20 rounded-full cursor-pointer relative group/progress"
                onClick={seek}
              >
                <div 
                  className="h-full bg-white relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-[0.2em] text-white">
                <div className="flex items-center gap-6">
                  <button onClick={togglePlay} className="hover:text-white/60 transition-colors uppercase">
                    {isPlaying ? "PAUSE" : "PLAY"}
                  </button>
                  <button onClick={toggleMute} className="hover:text-white/60 transition-colors uppercase">
                    {isMuted ? "UNMUTE" : "MUTE"}
                  </button>
                </div>
                <div className="font-mono text-white/40">
                  {Math.round(progress)}% CAPTURED
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Navbar() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || "";

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    if (q) {
      setSearchParams({ q });
    } else {
      setSearchParams({});
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 px-8 py-6 flex flex-col md:flex-row justify-between items-center bg-black/40 backdrop-blur-md gap-6">
      <div className="flex items-center gap-10 w-full md:w-auto">
        <Link to="/" className="text-xl font-display uppercase tracking-widest skew-x-[-10deg]">
          LocalLens
        </Link>
        <div className="relative flex-1 md:w-64 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input 
            type="text" 
            placeholder="Search chronicle..." 
            className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-xs tracking-wider outline-none focus:border-white/30 transition-all"
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
      </div>
      <div className="flex gap-8 items-center">
        <Link to="/" className="nav-link flex items-center gap-2">
          <HomeIcon className="w-4 h-4" /> <span className="hidden sm:inline">Home</span>
        </Link>
        {user ? (
          <>
            <Link to="/create" className="nav-link flex items-center gap-2">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Post</span>
            </Link>
            <button onClick={logout} className="nav-link flex items-center gap-2 cursor-pointer">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
            </button>
            <div className="flex items-center gap-2 text-white/40">
              <User className="w-4 h-4" />
              <span className="text-xs uppercase tracking-widest">{user.username}</span>
            </div>
          </>
        ) : (
          <Link to="/login" className="nav-link">Login</Link>
        )}
      </div>
    </nav>
  );
}

// --- Pages ---

function Home() {
  const [posts, setPosts] = useState<any[]>([]);
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.toLowerCase() || "";
  const filterUser = searchParams.get("user") || "";

  const fetchPosts = () => {
    const url = filterUser ? `/api/posts?username=${filterUser}` : "/api/posts";
    fetch(url)
      .then((res) => res.json())
      .then((data) => setPosts(data));
  };

  useEffect(() => {
    fetchPosts();
  }, [filterUser]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this story?")) return;
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) fetchPosts();
  };

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(query) || 
    post.content.toLowerCase().includes(query)
  );

  return (
    <main className="pt-48 md:pt-32 px-8 pb-20 max-w-7xl mx-auto">
      <header className="mb-20">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="meta-label opacity-100 text-white/40">
            {query ? `Results for "${query}"` : filterUser ? `Chronicle of @${filterUser}` : "Curated Local Feed"}
          </div>
          {filterUser && (
            <button 
              onClick={() => setSearchParams({})}
              className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest flex items-center gap-2"
            >
              Clear Filter <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <h1 className="editorial-title animate-slam">
          {query ? "Filtered<br />Lens" : filterUser ? `${filterUser}'s<br />Stories` : "The Visual<br />Chronicle"}
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-y-24">
        {filteredPosts.map((post, i) => (
          <motion.article 
            key={post.id}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: i % 3 * 0.1 }}
            className="group"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-white/5 mb-8">
              {post.media_url ? (
                post.media_type === "video" ? (
                  <VideoPlayer src={post.media_url} />
                ) : (
                  <img 
                    src={post.media_url} 
                    alt={post.title} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-105"
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-white/10" />
                </div>
              )}
              
              <div className="absolute top-4 left-4 flex gap-2">
                <button 
                  onClick={() => setSearchParams({ user: post.author })}
                  className="p-2 bg-black/60 backdrop-blur-md rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:text-black cursor-pointer"
                >
                  <span className="meta-label !opacity-100">@{post.author}</span>
                </button>
              </div>

              {user?.id === post.user_id && (
                <button 
                  onClick={() => handleDelete(post.id)}
                  className="absolute top-4 right-4 p-2 bg-red-500/20 text-red-500 backdrop-blur-md rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <h2 className="text-3xl mb-3 tracking-tighter group-hover:text-white/60 transition-colors">{post.title}</h2>
            <p className="text-white/40 text-[15px] leading-relaxed mb-6 line-clamp-3 font-serif italic border-l-2 border-white/5 pl-4">
               {post.content}
            </p>
            <div className="flex justify-between items-center text-[9px] uppercase tracking-[0.25em] font-bold text-white/20 border-t border-white/5 pt-4">
              <span>{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span className="bg-white/5 px-2 py-1 rounded">{post.media_type || "text"}</span>
            </div>
          </motion.article>
        ))}
        {filteredPosts.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-40">
            <p className="font-serif italic text-2xl">
              {query ? `No entries found for "${query}"` : "No stories captured yet."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const { user } = await res.json();
      login(user);
      navigate("/");
    } else {
      alert("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen pt-32 px-8 flex justify-center items-center">
      <div className="glass-card w-full max-w-md">
        <header className="mb-10 text-center">
          <div className="meta-label mb-2">Access Portal</div>
          <h2 className="text-4xl">Login</h2>
        </header>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="meta-label block mb-2">Email Address</label>
            <input 
              type="email" 
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none focus:border-white/30 transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="meta-label block mb-2">Password</label>
            <input 
              type="password" 
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none focus:border-white/30 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="w-full bg-white text-black py-4 font-display uppercase tracking-widest hover:bg-white/80 transition-colors rounded-lg">
            Authenticate
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-white/40">
          New here? <Link to="/register" className="text-white hover:underline">Create Account</Link>
        </p>
      </div>
    </div>
  );
}

function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    if (res.ok) {
      // Auto-login after successful registration
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (loginRes.ok) {
        const { user } = await loginRes.json();
        login(user);
        navigate("/");
      } else {
        navigate("/login");
      }
    } else {
      try {
        const data = await res.json();
        alert(`Registration failed: ${data.error}`);
      } catch (e) {
        alert("Registration failed");
      }
    }
  };

  return (
    <div className="min-h-screen pt-32 px-8 flex justify-center items-center">
      <div className="glass-card w-full max-w-md">
        <header className="mb-10 text-center">
          <div className="meta-label mb-2">Join LocalLens</div>
          <h2 className="text-4xl">Register</h2>
        </header>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="meta-label block mb-2">Username</label>
            <input 
              type="text" 
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none focus:border-white/30 transition-colors"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="meta-label block mb-2">Email Address</label>
            <input 
              type="email" 
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none focus:border-white/30 transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="meta-label block mb-2">Password</label>
            <input 
              type="password" 
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none focus:border-white/30 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="w-full bg-white text-black py-4 font-display uppercase tracking-widest hover:bg-white/80 transition-colors rounded-lg">
            Create Account
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-white/40">
          Have an account? <Link to="/login" className="text-white hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}

function CreatePost() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    const formData = new FormData();
    formData.append("title", title);
    formData.append("content", content);
    if (media) formData.append("media", media);

    const res = await fetch("/api/posts", {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    if (res.ok) navigate("/");
  };

  return (
    <div className="min-h-screen pt-32 px-8 pb-20 flex justify-center">
      <div className="glass-card w-full max-w-2xl">
        <header className="mb-10">
          <div className="meta-label mb-2">Drafting Station</div>
          <h2 className="text-4xl">New Story</h2>
        </header>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="meta-label block mb-2">Headline</label>
            <input 
              type="text" 
              className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-2xl outline-none focus:border-white/30 transition-colors"
              placeholder="Give it a title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="meta-label block mb-2">Visual Narrative (Photo or Video)</label>
            <div className="relative group cursor-pointer border-2 border-dashed border-white/10 rounded-xl p-12 text-center hover:border-white/30 transition-colors">
              <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => setMedia(e.target.files?.[0] || null)}
                accept="image/*,video/*"
              />
              {media ? (
                <div className="space-y-4">
                  <div className="text-white font-semibold">{media.name}</div>
                  <div className="text-xs text-white/40 uppercase tracking-widest">Click to Change</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Camera className="w-12 h-12 mx-auto text-white/20 group-hover:text-white/40 transition-colors" />
                  <div className="text-sm text-white/40 uppercase tracking-widest">Select Media Asset</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="meta-label block mb-2">Story Content</label>
            <textarea 
              rows={6}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-4 font-serif text-lg italic outline-none focus:border-white/30 transition-colors"
              placeholder="Tell the story behind the lens..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={uploading}
            className="w-full bg-white text-black py-5 font-display uppercase tracking-widest hover:bg-white/80 transition-all rounded-lg disabled:opacity-50"
          >
            {uploading ? "Publishing Fragment..." : "Publish to Chronicle"}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- Main App ---

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/create" element={<CreatePost />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-[#050505] selection:bg-white selection:text-black">
          <Navbar />
          <AnimatedRoutes />
          <footer className="py-20 px-8 text-center text-white/10 border-t border-white/5">
            <div className="meta-label">© 2026 LocalLens / Independent Local Node</div>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}
