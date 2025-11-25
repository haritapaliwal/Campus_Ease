import { useState, useContext, useEffect } from "react";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import AuthPrompt from "../components/AuthPrompt";
import { toast } from "sonner";

export default function BarberPage() {
  const { token } = useContext(AuthContext);
  const [bookedSlot, setBookedSlot] = useState(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showSuccess, setShowSuccess] = useState(false);

  // Generate dates for the next 7 days
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: date,
        day: days[date.getDay()],
        dayNum: date.getDate(),
        month: months[date.getMonth()],
        isToday: i === 0,
      });
    }
    return dates;
  };

  const dates = generateDates();

  useEffect(() => {
    loadSlots();
  }, [selectedDate]);

  const loadSlots = async () => {
    try {
      // Format date as YYYY-MM-DD for the API
      const dateStr = selectedDate.toISOString().split('T')[0];
      const res = await api.get(`/barber/slots?date=${dateStr}`);
      setAvailableSlots(res.data || []);
    } catch (e) {
      console.error("Failed to load slots", e);
      setAvailableSlots([]);
    }
  };

  const handleDateSelect = (dateObj) => {
    setSelectedDate(dateObj.date);
  };

  const handleSlotSelect = (slot) => {
    if (!token) {
      setShowAuthPrompt(true);
      return;
    }
    setSelectedSlot(slot);
  };

  const handleBooking = async () => {
    if (!selectedSlot) {
      toast.error("Please select a time slot");
      return;
    }
    
    if (!token) {
      setShowAuthPrompt(true);
      return;
    }
    
    try {
      // Format date as YYYY-MM-DD for the API
      const dateStr = selectedDate.toISOString().split('T')[0];
      await api.post("/barber/book", { 
        slot: selectedSlot,
        bookingDate: dateStr
      });
      setBookedSlot(selectedSlot);
      setShowSuccess(true);
      toast.success(`Booking confirmed for ${selectedSlot}`);
      setSelectedSlot(null);
      await loadSlots();
    } catch (err) {
      toast.error(err.response?.data?.message || "Booking failed");
    }
  };

  // Generate time slots - all slots are available by default for each new date
  // They become unavailable only if admin marks them or they reach capacity
  const generateTimeSlots = () => {
    return [
      "09:00 AM", "10:00 AM", "11:00 AM", 
      "12:00 PM", "01:00 PM", "02:00 PM", 
      "03:00 PM", "04:00 PM", "05:00 PM"
    ];
  };

  const timeSlots = generateTimeSlots();
  
  // For each date, all slots start as available
  // They only become unavailable if:
  // 1. The API says they're not available (admin marked unavailable or full)
  // 2. They're in the availableSlots array from the API

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthPrompt 
        isOpen={showAuthPrompt} 
        onClose={() => setShowAuthPrompt(false)}
        title="Sign in to Book Barber Appointment"
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white py-6">
        <div className="container-padded">
          <div className="flex items-center justify-between mb-4">
            <button className="w-10 h-10 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold">Salon</h1>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="container-padded py-6">
        {showSuccess && bookedSlot ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Booking Confirmed!</h2>
              <p className="text-gray-600 mb-6 text-lg">
                Your appointment is scheduled for <strong className="text-purple-600">{bookedSlot}</strong>
              </p>
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 mb-6 border border-purple-100">
                <p className="text-sm text-gray-600 mb-2">Please show this confirmation at the barber shop</p>
                <p className="text-lg font-semibold text-purple-600">{bookedSlot}</p>
              </div>
              <button
                onClick={() => {
                  setShowSuccess(false);
                  setBookedSlot(null);
                  setSelectedSlot(null);
                }}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600 transform transition-all duration-300 hover:scale-105 shadow-lg"
              >
                Book Another Appointment
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Choose the date Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Choose the date</h2>
              <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
                {dates.map((dateObj, idx) => {
                  const isSelected = 
                    dateObj.date.getDate() === selectedDate.getDate() &&
                    dateObj.date.getMonth() === selectedDate.getMonth() &&
                    dateObj.date.getFullYear() === selectedDate.getFullYear();
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => handleDateSelect(dateObj)}
                      className={`flex-shrink-0 px-5 py-3 rounded-xl font-semibold transition-all duration-300 min-w-[80px] ${
                        isSelected
                          ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg transform scale-105"
                          : "bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-600"
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-sm font-medium">{dateObj.day}</div>
                        <div className="text-lg font-bold mt-1">{dateObj.dayNum}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Choose the time Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Choose the time</h2>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {timeSlots.map((slot, i) => {
                  const isAvailable = availableSlots.includes(slot);
                  const isSelected = selectedSlot === slot;
                  
                  return (
                    <button
                      key={i}
                      onClick={() => isAvailable && handleSlotSelect(slot)}
                      disabled={!isAvailable}
                      className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 border-2 ${
                        !isAvailable
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50"
                          : isSelected
                          ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white border-purple-600 shadow-lg transform scale-105"
                          : "bg-white text-purple-600 border-purple-200 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 hover:border-purple-400"
                      }`}
                      title={!isAvailable ? "This slot is not available" : "Click to select this time"}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Book Appointment Button */}
            {selectedSlot && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 mb-4 border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Date</span>
                    <span className="font-semibold text-gray-900">
                      {dates.find(d => 
                        d.date.getDate() === selectedDate.getDate() &&
                        d.date.getMonth() === selectedDate.getMonth()
                      )?.day} {selectedDate.getDate()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Time</span>
                    <span className="font-semibold text-gray-900">{selectedSlot}</span>
                  </div>
                </div>
                <button
                  onClick={handleBooking}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-4 rounded-xl font-bold text-lg hover:from-purple-600 hover:to-blue-600 transform transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  Book Appointment
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
