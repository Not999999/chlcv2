import React, { Suspense } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Layout as ClassicLayout } from './Layout'; // Assuming classic layout is here
// Import animated theme specific styles if they are global and need to be injected
// import '../themes/animated-ui/styles/animated-theme.css'; // Import this conditionally or ensure it's scoped via data-theme

// Dynamically import the AnimatedLayout
const AnimatedLayout = React.lazy(() => import('../themes/animated-ui/components/Layout'));

interface ThemeApplicatorProps {
  children: React.ReactNode;
  // We might need to pass down a title or other layout-specific props,
  // but App.tsx's current Layout doesn't seem to take title directly at the top level.
  // Page components usually set their own titles via the Layout they are in.
  // For simplicity, let's assume the Layout components handle their titles internally or App structure changes.
}

const ThemeApplicator: React.FC<ThemeApplicatorProps> = ({ children }) => {
  const { currentTheme, isLoadingTheme } = useTheme();

  // This loading state is for the theme flag fetching itself.
  // The Suspense fallback will handle the lazy loading of the AnimatedLayout component.
  if (isLoadingTheme) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-[9999]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-gray-700"></div>
        <p className="ml-4 text-lg text-gray-700">Initializing Theme...</p>
      </div>
    );
  }

  if (currentTheme === 'animated') {
    return (
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 text-white z-[9999]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-300"></div>
          <p className="ml-4 text-lg">Loading Animated Experience...</p>
        </div>
      }>
        {/*
          The AnimatedLayout will receive children (Routes).
          It should be structured similarly to ClassicLayout to accept and render them.
          If AnimatedLayout needs specific props that ClassicLayout doesn't, that needs to be handled.
        */}
        <AnimatedLayout>
          {children}
        </AnimatedLayout>
      </Suspense>
    );
  }

  // Default to Classic Layout
  // ClassicLayout should already be part of the main bundle.
  return (
    <ClassicLayout>
      {children}
    </ClassicLayout>
  );
};

export default ThemeApplicator;
