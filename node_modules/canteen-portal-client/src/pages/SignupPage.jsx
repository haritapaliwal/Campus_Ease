import { useState, useContext } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { toast } from "sonner";

export default function SignupPage() {
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
      isValid: minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
      requirements: {
        minLength,
        hasUpperCase,
        hasLowerCase,
        hasNumbers,
        hasSpecialChar
      }
    };
  };

  const validateForm = () => {
    const newErrors = {};

    // Student ID validation
    if (!studentId.trim()) {
      newErrors.studentId = "Student ID is required";
    } else if (studentId.trim().length < 3) {
      newErrors.studentId = "Student ID must be at least 3 characters";
    }

    // Email validation
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Password validation
    if (!password) {
      newErrors.password = "Password is required";
    } else {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        newErrors.password = "Password does not meet requirements";
      }
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
      await api.post("/auth/signup", { studentId, email, password });
      const res = await api.post("/auth/login", { email, password });
      if (res.data?.token) {
        login(res.data.token, res.data.role, res.data.shopId);
        toast.success("Account created successfully! Welcome!");
        navigate("/");
      } else {
        toast.error("Signup succeeded but auto-login failed. Please log in manually.");
        navigate("/login");
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Signup failed";
      
      // Handle specific error cases
      if (errorMessage.toLowerCase().includes("already exists") || 
          errorMessage.toLowerCase().includes("duplicate")) {
        toast.error("User already exists with this email");
        setErrors({ email: "This email is already registered" });
      } else if (errorMessage.toLowerCase().includes("email")) {
        toast.error("Invalid email format");
        setErrors({ email: "Please enter a valid email address" });
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
                <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">Create Account</h1>
                <p className="text-center text-gray-500 mb-8">
                  Sign up quickly using your campus email
                </p>

                {/* Form */}
                <form className="space-y-6" onSubmit={handleSubmit}>
                  {/* Shop owners cannot sign up here; students only */}
                  <div>
                    <input
                      type="text"
                      placeholder="Student ID"
                      value={studentId}
                      onChange={(e) => {
                        setStudentId(e.target.value);
                        if (errors.studentId) {
                          setErrors(prev => ({ ...prev, studentId: "" }));
                        }
                      }}
                      className={`w-full px-4 py-4 rounded-xl border-2 focus:outline-none focus:ring-4 transition-all duration-300 text-gray-700 placeholder-gray-400 ${
                        errors.studentId 
                          ? "border-red-500 focus:border-red-500 focus:ring-red-100" 
                          : "border-gray-200 focus:border-purple-500 focus:ring-purple-100"
                      }`}
                    />
                    {errors.studentId && (
                      <p className="mt-2 text-sm text-red-600 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errors.studentId}
                      </p>
                    )}
                  </div>

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
                    
                    {/* Password Requirements */}
                    {password && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-2">Password Requirements:</p>
                        <div className="space-y-1">
                          {[
                            { text: "At least 8 characters", valid: password.length >= 8 },
                            { text: "One uppercase letter", valid: /[A-Z]/.test(password) },
                            { text: "One lowercase letter", valid: /[a-z]/.test(password) },
                            { text: "One number", valid: /\d/.test(password) },
                            { text: "One special character", valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
                          ].map((req, index) => (
                            <div key={index} className="flex items-center text-sm">
                              <svg 
                                className={`w-4 h-4 mr-2 ${req.valid ? 'text-green-500' : 'text-gray-400'}`} 
                                fill="currentColor" 
                                viewBox="0 0 20 20"
                              >
                                {req.valid ? (
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                ) : (
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                )}
                              </svg>
                              <span className={req.valid ? 'text-green-600' : 'text-gray-500'}>
                                {req.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                        Creating Account...
                      </div>
                    ) : (
                      "Sign up"
                    )}
                  </button>
                </form>

                {/* Footer */}
                <p className="mt-8 text-center text-gray-600">
                  Already have an account?{" "}
                  <a href="/login" className="text-purple-600 font-semibold hover:text-purple-700 transition-colors duration-300">
                    Login
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
