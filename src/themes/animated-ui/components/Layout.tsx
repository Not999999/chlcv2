import React, { ReactNode } from 'react';

interface AnimatedLayoutProps {
  children: ReactNode;
  title?: string; // Assuming title is a prop like in the classic Layout
}

// Basic stub for the Animated Layout
// This would eventually contain the distinct layout structure for the animated theme
export const AnimatedLayout: React.FC<AnimatedLayoutProps> = ({ children, title }) => {
  // Potentially use a different global structure, nav, header, footer for animated theme
  // The fixed header requires padding on the main content area.
  // Assuming header height is approx 4rem (p-3 y-padding + line height) to 5rem. pt-16 (4rem) or pt-20 (5rem).
  // Let's make header padding slightly smaller on mobile for aesthetics.
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col data-[theme='animated']:bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <header className="w-full p-3 sm:p-4 bg-gray-800/80 data-[theme='animated']:bg-purple-800/80 backdrop-blur-md text-center fixed top-0 z-50 shadow-lg">
        <h1 className="text-lg sm:text-xl font-bold data-[theme='animated']:text-yellow-300">
          {title || 'EduSync - Animated Portal'}
        </h1>
        {/* Subtitle can be removed or kept if desired for the theme */}
        {/* <p className="text-xs data-[theme='animated']:text-yellow-100">Animated Theme</p> */}
      </header>
      {/* Adjust pt value based on actual rendered height of header.
          p-3 (0.75rem) y-padding means 1.5rem total vertical padding.
          text-lg/xl line height is ~1.75rem. Total ~3.25rem. pt-16 (4rem) should be safe.
      */}
      <main className="flex-grow w-full max-w-6xl mx-auto p-3 sm:p-4 pt-16 sm:pt-20">
        {children}
      </main>
      <footer className="w-full p-3 sm:p-4 bg-gray-800/80 data-[theme='animated']:bg-purple-800/80 backdrop-blur-md text-center text-xs border-t border-gray-700 data-[theme='animated']:border-purple-700">
        &copy; {new Date().getFullYear()} EduSync Animated Theme Footer
      </footer>
    </div>
  );
};

// Export default for React.lazy
export default AnimatedLayout;
