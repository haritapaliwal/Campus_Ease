import { useState, useContext, useEffect } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const { login, token } = useContext(AuthContext);
  const [userType, setUserType] = useState("customer");
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      navigate("/");
    }
  }, [token, navigate]);

  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error("Please fix the errors below");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      // If the credentials correspond to an owner but user selected "customer", block admin login
      if (res.data.role === "owner" && userType !== "owner") {
        // Mimic invalid credentials to avoid exposing owner access without explicit intent
        setErrors({ 
          email: "Invalid email or password", 
          password: "Invalid email or password" 
        });
        toast.error("Invalid email or password");
        return;
      }
      
      // If user selected "owner" but credentials are for a customer, block login
      if (res.data.role === "student" && userType === "owner") {
        setErrors({ 
          email: "Invalid email or password", 
          password: "Invalid email or password" 
        });
        toast.error("Invalid email or password");
        return;
      }

      // server returns role and shopId as well
      login(res.data.token, res.data.role, res.data.shopId);
      toast.success("Welcome back!");
      navigate(res.data.role === "owner" ? "/owner" : "/");
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Login failed";
      
      if (errorMessage.toLowerCase().includes("not found") || 
          errorMessage.toLowerCase().includes("invalid")) {
        toast.error("Invalid email or password");
        setErrors({ 
          email: "Invalid email or password",
          password: "Invalid email or password"
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-500 hover:scale-[1.02]">
          <div className="flex min-h-[600px]">
            {/* Left Side - Gradient Background with Floating Elements */}
            <div className="w-2/5 relative overflow-hidden bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400">
              {/* Floating Spheres */}
              <div className="absolute inset-0">
                <div className="absolute top-20 left-10 w-32 h-32 bg-white/20 rounded-full blur-xl animate-pulse"></div>
                <div className="absolute top-40 right-8 w-20 h-20 bg-white/30 rounded-full blur-lg animate-bounce"></div>
                <div className="absolute bottom-32 left-16 w-24 h-24 bg-white/25 rounded-full blur-xl animate-pulse delay-1000"></div>
                <div className="absolute bottom-20 right-12 w-16 h-16 bg-white/35 rounded-full blur-md animate-bounce delay-500"></div>
                <div className="absolute top-60 left-1/2 w-28 h-28 bg-white/20 rounded-full blur-2xl animate-pulse delay-700"></div>
              </div>
              
              {/* Decorative Elements */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent"></div>
            </div>

            {/* Right Side - Form */}
            <div className="w-3/5 p-12 flex flex-col justify-center">
              <div className="max-w-md mx-auto w-full">
                <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Sign In</h1>
                
                {/* Social Login Buttons */}
                <div className="space-y-4 mb-8">
                  <button className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-3 px-6 rounded-xl font-medium flex items-center justify-center space-x-3 hover:from-purple-600 hover:to-blue-600 transform transition-all duration-300 hover:scale-105 shadow-lg">
                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-bold text-sm">G</span>
                    </div>
                    <span>Sign in with Google</span>
                  </button>
                  
                  <button className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-xl font-medium flex items-center justify-center space-x-3 hover:bg-gray-50 transform transition-all duration-300 hover:scale-105 shadow-md">
                    <div className="w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">f</span>
                    </div>
                    <span>Sign in with Facebook</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="relative mb-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">Or Sign in with your email address</span>
                  </div>
                </div>

                {/* Form */}
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div>
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) {
                          setErrors(prev => ({ ...prev, email: "" }));
                        }
                      }}
                      className={`w-full px-4 py-4 rounded-xl border-2 focus:outline-none focus:ring-4 transition-all duration-300 text-gray-700 placeholder-gray-400 ${
                        errors.email 
                          ? "border-red-500 focus:border-red-500 focus:ring-red-100" 
                          : "border-gray-200 focus:border-purple-500 focus:ring-purple-100"
                      }`}
                    />
                    {errors.email && (
                      <p className="mt-2 text-sm text-red-600 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errors.email}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) {
                          setErrors(prev => ({ ...prev, password: "" }));
                        }
                      }}
                      className={`w-full px-4 py-4 rounded-xl border-2 focus:outline-none focus:ring-4 transition-all duration-300 text-gray-700 placeholder-gray-400 ${
                        errors.password 
                          ? "border-red-500 focus:border-red-500 focus:ring-red-100" 
                          : "border-gray-200 focus:border-purple-500 focus:ring-purple-100"
                      }`}
                    />
                    {errors.password && (
                      <p className="mt-2 text-sm text-red-600 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div>
                    <select
                      value={userType}
                      onChange={(e) => setUserType(e.target.value)}
                      className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-300 text-gray-700 bg-white"
                    >
                      <option value="customer">Login as Customer</option>
                      <option value="owner">Login as Shop Owner</option>
                    </select>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transform transition-all duration-300 shadow-lg ${
                      isLoading 
                        ? "bg-gray-400 cursor-not-allowed" 
                        : "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 hover:scale-105"
                    }`}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing in...
                      </div>
                    ) : (
                      "Sign in"
                    )}
                  </button>
                </form>

                {/* Footer */}
                <p className="mt-8 text-center text-gray-600">
                  Don't have an account?{" "}
                  <a href="/signup" className="text-purple-600 font-semibold hover:text-purple-700 transition-colors duration-300">
                    Sign up
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
