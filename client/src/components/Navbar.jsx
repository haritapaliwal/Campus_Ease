import { Link, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { token, role, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200/50 shadow-sm">
      <div className="container-padded">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <Link to="/" className="flex items-center space-x-3 group" onClick={() => setIsOpen(false)}>
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
              <span className="text-white font-bold text-lg">CE</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-900">CampusEase</h1>
              <p className="text-xs text-gray-500">Student Services Portal</p>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              to="/" 
              className="text-gray-700 hover:text-purple-600 font-medium transition-colors duration-300 relative group"
            >
              Home
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            {(!role || role === "customer") && (
              <>
                <Link 
                  to="/food" 
                  className="text-gray-700 hover:text-purple-600 font-medium transition-colors duration-300 relative group"
                >
                  Food
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 group-hover:w-full"></span>
                </Link>
                <Link 
                  to="/barber" 
                  className="text-gray-700 hover:text-purple-600 font-medium transition-colors duration-300 relative group"
                >
                  Barber
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 group-hover:w-full"></span>
                </Link>
                <Link 
                  to="/laundry" 
                  className="text-gray-700 hover:text-purple-600 font-medium transition-colors duration-300 relative group"
                >
                  Laundry
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 group-hover:w-full"></span>
                </Link>
              </>
            )}
            {token && role === "customer" && (
              <Link 
                to="/my-bookings" 
                className="text-gray-700 hover:text-purple-600 font-medium transition-colors duration-300 relative group"
              >
                My Bookings
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 group-hover:w-full"></span>
              </Link>
            )}
            {token && role === "shop_owner" && (
              <Link 
                to="/shop-owner" 
                className="text-gray-700 hover:text-purple-600 font-medium transition-colors duration-300 relative group"
              >
                Shop Dashboard
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 group-hover:w-full"></span>
              </Link>
            )}
            {token && role === "admin" && (
              <Link 
                to="/admin" 
                className="text-gray-700 hover:text-purple-600 font-medium transition-colors duration-300 relative group"
              >
                Admin Panel
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 group-hover:w-full"></span>
              </Link>
            )}
            {!token && (
              <>
                <Link 
                  to="/login" 
                  className="text-gray-700 hover:text-purple-600 font-medium transition-colors duration-300 relative group"
                >
                  Login
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 group-hover:w-full"></span>
                </Link>
                <Link 
                  to="/signup" 
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full font-semibold hover:from-purple-600 hover:to-blue-600 transform transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="md:hidden">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 hover:text-purple-600 p-2 focus:outline-none transition-colors rounded-lg hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Logout Button (Desktop) */}
          {token && (
            <div className="hidden md:block">
              <button
                onClick={handleLogout}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full font-semibold hover:from-purple-600 hover:to-blue-600 transform transition-all duration-300 hover:scale-105 shadow-lg flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Navigation Menu */}
        {isOpen && (
          <div className="md:hidden border-t border-gray-100 py-4 transition-all duration-300 animate-fadeIn">
            <div className="flex flex-col space-y-2">
              <Link 
                to="/" 
                onClick={() => setIsOpen(false)}
                className="text-gray-700 hover:text-purple-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 transition-colors"
              >
                Home
              </Link>
              {(!role || role === "customer") && (
                <>
                  <Link 
                    to="/food" 
                    onClick={() => setIsOpen(false)}
                    className="text-gray-700 hover:text-purple-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    Food
                  </Link>
                  <Link 
                    to="/barber" 
                    onClick={() => setIsOpen(false)}
                    className="text-gray-700 hover:text-purple-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    Barber
                  </Link>
                  <Link 
                    to="/laundry" 
                    onClick={() => setIsOpen(false)}
                    className="text-gray-700 hover:text-purple-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    Laundry
                  </Link>
                </>
              )}
              {token && role === "customer" && (
                <Link 
                  to="/my-bookings" 
                  onClick={() => setIsOpen(false)}
                  className="text-gray-700 hover:text-purple-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  My Bookings
                </Link>
              )}
              {token && role === "shop_owner" && (
                <Link 
                  to="/shop-owner" 
                  onClick={() => setIsOpen(false)}
                  className="text-gray-700 hover:text-purple-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  Shop Dashboard
                </Link>
              )}
              {token && role === "admin" && (
                <Link 
                  to="/admin" 
                  onClick={() => setIsOpen(false)}
                  className="text-gray-700 hover:text-purple-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  Admin Panel
                </Link>
              )}
              {token ? (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleLogout();
                  }}
                  className="w-full mt-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600 transition-all duration-300 flex items-center justify-center space-x-2 shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>
              ) : (
                <div className="flex flex-col space-y-2 pt-2 border-t border-gray-100">
                  <Link 
                    to="/login" 
                    onClick={() => setIsOpen(false)}
                    className="text-gray-700 hover:text-purple-600 font-medium py-2 px-3 rounded-lg hover:bg-purple-50 transition-colors text-center"
                  >
                    Login
                  </Link>
                  <Link 
                    to="/signup" 
                    onClick={() => setIsOpen(false)}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600 transition-all duration-300 text-center shadow-md"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
