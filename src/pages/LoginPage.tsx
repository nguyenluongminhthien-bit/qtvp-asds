import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('thaco_saved_username');
    const savedPassBase64 = localStorage.getItem('thaco_saved_password');
    const isRemembered = localStorage.getItem('thaco_remember_me') === 'true';

    if (isRemembered) {
      if (savedUser) setUsername(savedUser);
      if (savedPassBase64) {
        try {
          setPassword(window.atob(savedPassBase64));
        } catch (e) {
          setPassword('');
        }
      }
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(username, password, rememberMe);
      if (rememberMe) {
        localStorage.setItem('thaco_saved_username', username);
        localStorage.setItem('thaco_saved_password', window.btoa(password));
        localStorage.setItem('thaco_remember_me', 'true');
      } else {
        localStorage.removeItem('thaco_saved_username');
        localStorage.removeItem('thaco_saved_password');
        localStorage.setItem('thaco_remember_me', 'false');
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f9] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-[#05469B] to-[#032a5e] p-8 text-center shadow-inner">
          <h1 className="text-[27px] leading-[33px] font-black text-white tracking-widest font-sans">QUẢN TRỊ VĂN PHÒNG & AN SINH ĐỜI SỐNG</h1>
          <p className="text-blue-200 mt-2 text-sm uppercase tracking-wider font-semibold">Hệ thống Quản lý Nội bộ</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-3 border border-red-100 animate-in fade-in">
              <AlertCircle size={20} className="shrink-0 mt-0.5" /> 
              <p className="font-medium">{error}</p>
            </div>
          )}
          
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Tên đăng nhập</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  required 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  className="w-full pl-11 pr-4 py-3 bg-[#FFFFF0] border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#05469B] outline-none transition-all font-medium text-gray-800" 
                  placeholder="VD: admin@thaco.com.vn" 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full pl-11 pr-11 py-3 bg-[#FFFFF0] border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#05469B] outline-none transition-all font-medium text-gray-800" 
                  placeholder="••••••••" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-5 h-5 border-2 border-gray-300 rounded text-[#05469B] focus:ring-[#05469B] focus:ring-offset-0 transition-all cursor-pointer peer" 
                />
              </div>
              <span className="text-sm font-semibold text-gray-600 group-hover:text-[#05469B] transition-colors select-none">
                Ghi nhớ đăng nhập
              </span>
            </label>
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-[#05469B] hover:bg-[#032a5e] text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0">
            {isLoading ? <Loader2 className="animate-spin" size={22} /> : 'Đăng nhập hệ thống'}
          </button>
        </form>
      </div>
    </div>
  );
}