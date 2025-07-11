import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedIntroProps {
  onFinish: () => void;
}

const INTRO_SESSION_STORAGE_KEY = 'eduSyncAnimatedIntroShown';

const AnimatedIntro: React.FC<AnimatedIntroProps> = ({ onFinish }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(INTRO_SESSION_STORAGE_KEY)) {
        onFinish();
      } else {
        setIsVisible(true);
      }
    } catch (e) {
      // Fallback for environments where sessionStorage is not available (e.g. SSR, some iframes)
      console.warn("sessionStorage not available for intro animation tracking.", e);
      setIsVisible(true); // Show intro if we can't track
    }
  }, [onFinish]);

  const handleAnimationComplete = () => {
    try {
      sessionStorage.setItem(INTRO_SESSION_STORAGE_KEY, 'true');
    } catch (e) {
      console.warn("sessionStorage not available for setting intro flag.", e);
    }
    setIsVisible(false);
    // Delay onFinish slightly to allow exit animation
    setTimeout(onFinish, 500);
  };

  const handleSkip = () => {
    handleAnimationComplete();
  };

  const [numStars, setNumStars] = useState(100); // Default to desktop

  useEffect(() => {
    const getStarCount = () => {
      if (typeof window !== 'undefined') {
        if (window.innerWidth < 640) return 30; // Small screens (mobile)
        if (window.innerWidth < 1024) return 60; // Medium screens (tablet)
        return 100; // Large screens (desktop)
      }
      return 100; // Default for SSR or if window is not defined
    };
    setNumStars(getStarCount());

    // Optional: Add resize listener if dynamic change is desired while intro is visible,
    // but for a short intro, mount check is often enough.
    // const handleResize = () => setNumStars(getStarCount());
    // window.addEventListener('resize', handleResize);
    // return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Star background (simple version)
  const StarField = useMemo(() => {
    // Ensure numStars has a valid number before creating array
    const currentNumStars = typeof numStars === 'number' && numStars > 0 ? numStars : 30;
    const stars = Array.from({ length: currentNumStars }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.3,
      duration: Math.random() * 2 + 1, // Duration for one cycle of twinkle
      delay: Math.random() * 2, // Delay before starting twinkle
    }));

    return (
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, zIndex: -1 }}>
        {stars.map(star => (
          <motion.circle
            key={star.id}
            cx={`${star.x}%`}
            cy={`${star.y}%`}
            r={star.size}
            fill="white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [star.opacity / 2, star.opacity, star.opacity / 2] }}
            transition={{
              delay: star.delay,
              duration: star.duration,
              repeat: Infinity,
              repeatType: 'mirror',
              ease: 'easeInOut',
            }}
          />
        ))}
      </svg>
    );
  }, []);


  if (!isVisible) {
    return null; // Don't render anything if already shown or skipped
  }

  const eduSyncText = "EduSync";
  const byShanText = "by Shan";

  const titleVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.15,
      },
    },
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120 } },
  };

  const subtitleVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { delay: eduSyncText.length * 0.15 + 0.5, duration: 0.8 } },
  };


  return (
    <AnimatePresence onExitComplete={onFinish}>
      {isVisible && (
        <motion.div
          key="intro-screen"
          initial={{ opacity: 1 }} // Start visible if isVisible is true
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-gray-950 overflow-hidden"
        >
          {StarField}

          <motion.h1
            variants={titleVariants}
            initial="hidden"
            animate="visible"
            // Adjusted base font size for smaller screens, sm and md will scale it up.
            // Added default text color as fallback for browsers not supporting background-clip: text
            className="text-5xl sm:text-6xl md:text-7xl font-bold mb-2 sm:mb-3 text-yellow-300 supports-[background-clip:text]:text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-300"
            style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text' }}
          >
            {eduSyncText.split("").map((char, index) => (
              <motion.span key={index} variants={letterVariants} className="inline-block">
                {char}
              </motion.span>
            ))}
          </motion.h1>

          <motion.p
            variants={subtitleVariants}
            initial="hidden"
            animate="visible"
            // Adjusted base font size
            className="text-lg sm:text-xl md:text-2xl text-gray-300"
          >
            {byShanText}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: eduSyncText.length * 0.15 + 1.2, duration: 0.5 }}
            // Responsive margin for the skip button container
            className="mt-8 sm:mt-10 md:mt-12"
          >
            <button
              onClick={handleSkip}
              // Responsive padding for the skip button
              className="px-6 sm:px-8 py-2 sm:py-3 bg-white/5 text-gray-300 rounded-full hover:bg-white/10 border border-white/20 transition-colors text-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-950"
            >
              Skip Intro
            </button>
          </motion.div>

          {/* Auto-skip after a certain total duration for the animation sequence */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%"}}
            transition={{ duration: 6, delay: 0.5, ease: "linear" }} // Total animation time approx 5-6s
            onAnimationComplete={handleAnimationComplete} // Auto-skip when progress bar finishes
            className="absolute bottom-0 left-0 h-1 bg-purple-500"
            style={{boxShadow: '0 0 10px #a855f7, 0 0 20px #a855f7'}}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedIntro;
