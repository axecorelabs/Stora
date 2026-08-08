"use client";

export default function LoadingOverlay({ 
  isVisible = false, 
  color = "#0D9488",
  message = "Loading...",
  fullScreen = true 
}) {
  if (!isVisible) return null;

  return (
    <div 
      className={`${
        fullScreen ? 'fixed' : 'absolute'
      } inset-0 flex flex-col items-center justify-center z-50`}
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
        {/* Bouncing Dots */}
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full dot-bounce"
            style={{ 
              backgroundColor: color,
              animationDelay: '0ms'
            }}
          />
          <div 
            className="w-3 h-3 rounded-full dot-bounce"
            style={{ 
              backgroundColor: color,
              animationDelay: '150ms'
            }}
          />
          <div 
            className="w-3 h-3 rounded-full dot-bounce"
            style={{ 
              backgroundColor: color,
              animationDelay: '300ms'
            }}
          />
        </div>
        
        {/* Loading Message */}
        {/* {message && (
          <p className="text-gray-700 font-medium text-sm">
            {message}
          </p>
        )} */}
      </div>

      <style jsx>{`
        @keyframes dotBounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }

        .dot-bounce {
          animation: dotBounce 0.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
