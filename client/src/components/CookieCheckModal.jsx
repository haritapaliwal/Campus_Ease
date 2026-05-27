import { useState } from "react";

export default function CookieCheckModal({ isOpen }) {
  const [activeTab, setActiveTab] = useState("safari_ios");

  if (!isOpen) return null;

  const tabs = [
    { id: "safari_ios", label: "iOS Safari" },
    { id: "chrome_ios", label: "iOS Chrome" },
    { id: "chrome_android", label: "Android Chrome" }
  ];

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-white/90 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl p-8 transform transition-all duration-500 hover:scale-[1.01] overflow-hidden relative">
        {/* Soft colorful blur background decorations */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-pink-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 text-purple-600 animate-bounce">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
              Action Required: Enable Cookies
            </h2>
            <p className="text-gray-600 max-w-md text-sm md:text-base leading-relaxed">
              We detected that your browser is blocking third-party cookies or cross-site tracking. Since our system uses secure cookies, please enable them to place orders, book slots, or talk to our AI assistant.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 mb-6 overflow-x-auto whitespace-nowrap scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 text-center py-3 px-4 font-semibold text-sm transition-all duration-300 border-b-2 outline-none focus:outline-none ${
                  activeTab === tab.id
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 min-h-[180px] mb-8">
            {activeTab === "safari_ios" && (
              <div className="space-y-4 animate-fade-in">
                <p className="font-semibold text-gray-800">For Apple Safari on iPhone/iPad:</p>
                <ol className="list-decimal list-inside space-y-2.5 text-gray-600 text-sm md:text-base">
                  <li>Open the <span className="font-semibold text-gray-800">Settings</span> app on your iOS device.</li>
                  <li>Scroll down and tap on <span className="font-semibold text-gray-800">Safari</span>.</li>
                  <li>Scroll down to the <span className="font-semibold text-gray-800">Privacy & Security</span> section.</li>
                  <li>Toggle <span className="font-semibold text-red-500">OFF</span> the <span className="font-semibold text-gray-800">Prevent Cross-Site Tracking</span> setting.</li>
                  <li>Restart Safari and refresh this page.</li>
                </ol>
              </div>
            )}

            {activeTab === "chrome_ios" && (
              <div className="space-y-4 animate-fade-in">
                <p className="font-semibold text-gray-800">For Google Chrome on iPhone/iPad:</p>
                <ol className="list-decimal list-inside space-y-2.5 text-gray-600 text-sm md:text-base">
                  <li>Open the <span className="font-semibold text-gray-800">Settings</span> app on your iOS device.</li>
                  <li>Scroll down and tap on <span className="font-semibold text-gray-800">Chrome</span>.</li>
                  <li>Toggle <span className="font-semibold text-green-500">ON</span> the <span className="font-semibold text-gray-800">Allow Cross-Website Tracking</span> setting.</li>
                  <li>Restart Chrome and refresh this page.</li>
                </ol>
              </div>
            )}

            {activeTab === "chrome_android" && (
              <div className="space-y-4 animate-fade-in">
                <p className="font-semibold text-gray-800">For Google Chrome on Android Devices:</p>
                <ol className="list-decimal list-inside space-y-2.5 text-gray-600 text-sm md:text-base">
                  <li>Open <span className="font-semibold text-gray-800">Chrome</span> on your phone.</li>
                  <li>Tap the three dots (<span className="font-semibold text-gray-800">Menu</span>) in the top-right corner, then tap <span className="font-semibold text-gray-800">Settings</span>.</li>
                  <li>Tap <span className="font-semibold text-gray-800">Site Settings</span>, then select <span className="font-semibold text-gray-800">Cookies</span> (or <span className="font-semibold text-gray-800">Third-party cookies</span>).</li>
                  <li>Select <span className="font-semibold text-green-500">Allow third-party cookies</span> (or allow them specifically for this site).</li>
                  <li>Refresh this page.</li>
                </ol>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleRefresh}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold rounded-xl shadow-lg hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17"></path>
              </svg>
              I Enabled It, Refresh Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
