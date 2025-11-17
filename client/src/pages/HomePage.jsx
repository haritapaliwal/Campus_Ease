import { useState, useContext } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function HomePage() {
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const sections = [
    {
      title: "🍔 Food & Dining",
      description: "View menus, pre-book meals, and choose delivery or pickup from campus restaurants.",
      path: "/food",
      icon: "🍽️",
      color: "from-orange-400 to-red-500"
    },
    {
      title: "💈 Barber Services",
      description: "Book haircut or shaving appointments with available slots at campus barbershops.",
      path: "/barber",
      icon: "✂️",
      color: "from-blue-400 to-indigo-500"
    },
    {
      title: "👕 Laundry Services",
      description: "Reserve laundry slots and get digital booking receipts for convenient washing.",
      path: "/laundry",
      icon: "🧺",
      color: "from-green-400 to-teal-500"
    },
  ];


  const handleSearch = () => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return;

    // Explicit "all" handling
    if (term === 'all') {
      setActiveFilter('All');
      return;
    }

    // Filter services based on search term
    if (term.includes('food') || term.includes('meal') || term.includes('restaurant') || term.includes('dining')) {
      setActiveFilter('Food');
      return;
    }
    if (term.includes('barber') || term.includes('hair') || term.includes('cut') || term.includes('salon')) {
      setActiveFilter('Barber');
      return;
    }
    if (term.includes('laundry') || term.includes('wash') || term.includes('clothes') || term.includes('washing')) {
      setActiveFilter('Laundry');
      return;
      
    }

    // Invalid input: show possible inputs
    toast.info("Try: 'all', 'food', 'barber', or 'laundry'");
  };

  const filteredSections = activeFilter === "All" 
    ? sections 
    : sections.filter(section => section.title.toLowerCase().includes(activeFilter.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400">
        {/* Floating Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-32 h-32 bg-white/20 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-8 w-20 h-20 bg-white/30 rounded-full blur-lg animate-bounce"></div>
          <div className="absolute bottom-32 left-16 w-24 h-24 bg-white/25 rounded-full blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-20 right-12 w-16 h-16 bg-white/35 rounded-full blur-md animate-bounce delay-500"></div>
          <div className="absolute top-60 left-1/2 w-28 h-28 bg-white/20 rounded-full blur-2xl animate-pulse delay-700"></div>
        </div>

        <div className="relative z-10 container-padded py-20">
          <div className="text-center text-white mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Find Your Campus Services
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
              Discover food, barber, and laundry services delivered fresh and convenient to your campus life.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Find campus services here..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full px-6 py-4 rounded-xl border-2 border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/70 focus:outline-none focus:border-white/40 focus:bg-white/20 transition-all duration-300"
                />
                <svg className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select className="px-6 py-4 rounded-xl border-2 border-white/20 bg-white/10 backdrop-blur-sm text-white focus:outline-none focus:border-white/40 transition-all duration-300">
                <option className="bg-gray-800">All Locations</option>
                <option className="bg-gray-800">BH4</option>
                <option className="bg-gray-800">Nescafe</option>
                <option className="bg-gray-800">Main Canteen</option>
              </select>
              <button
                onClick={handleSearch}
                className="px-8 py-4 bg-white text-purple-600 rounded-xl font-semibold hover:bg-white/90 transform transition-all duration-300 hover:scale-105 shadow-lg"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Decorative Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 120" className="w-full h-20 fill-gray-50">
            <path d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>
          </svg>
        </div>
      </div>


      {/* Services Section */}
      <div className="py-20 bg-gray-50">
        <div className="container-padded">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Services</h2>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {["All", "Food", "Barber", "Laundry"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                    activeFilter === filter
                      ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg"
                      : "bg-white text-gray-600 border-2 border-gray-200 hover:border-purple-300"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredSections.map((section, index) => (
              <div
                key={index}
                onClick={() => navigate(section.path)}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transform transition-all duration-300 hover:scale-105 cursor-pointer group"
              >
                <div className={`h-48 bg-gradient-to-br ${section.color} flex items-center justify-center text-6xl group-hover:scale-110 transition-transform duration-300`}>
                  {section.icon}
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{section.title}</h3>
                  <p className="text-gray-600 mb-4">{section.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-purple-600">Explore Now</span>
                    <div className="flex space-x-2">
                      <button className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-500 hover:bg-red-200 transition-colors duration-300">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-500 hover:bg-green-200 transition-colors duration-300">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
          </div>
        ))}
          </div>

        </div>
      </div>

    </div>
  );
}
