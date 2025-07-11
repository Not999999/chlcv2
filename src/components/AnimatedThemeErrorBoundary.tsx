import React, { ErrorInfo, ReactNode } from 'react';
import { ThemeName } from '../contexts/ThemeContext'; // Assuming ThemeName is exported

interface Props {
  children: ReactNode;
  setAppTheme: (theme: ThemeName) => Promise<void>; // Function to switch theme globally
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void; // Toast function
  fallbackUI?: ReactNode; // Optional custom fallback UI
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class AnimatedThemeErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI or trigger theme switch.
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Animated Theme Error Boundary Caught:", error, errorInfo);

    this.props.showToast(
      "Animated theme encountered an issue. Switched to classic view.",
      "error"
    );

    try {
      // Attempt to switch theme back to classic
      // This might cause a re-render of the parent, potentially unmounting this boundary
      // or re-rendering children with the classic theme.
      await this.props.setAppTheme('classic');
       // If setAppTheme causes a full re-render from App.tsx with classic theme,
       // this boundary might be unmounted or its children changed, so a specific fallback UI here
       // might only be briefly visible or not at all if the switch is fast.
    } catch (themeSetError) {
      console.error("Failed to switch theme back to classic after error:", themeSetError);
      this.props.showToast(
        "Critical: Failed to switch back to classic theme. Please refresh.",
        "error"
      );
      // At this point, the app might be in a very unstable state.
      // A more robust solution might involve a hard reload or specific instructions.
    }
  }

  render() {
    if (this.state.hasError) {
      // Option 1: Render a specific fallback UI for the error state.
      // This might be shown briefly before the theme switch re-renders the app.
      if (this.props.fallbackUI) {
        return this.props.fallbackUI;
      }
      // Option 2: Render nothing, relying on the theme switch to fix the UI.
      // This is often preferable if the theme switch results in a full re-render
      // from a higher level component that no longer renders the crashing animated components.
      // However, if setAppTheme doesn't immediately cause an unmount of the erroring component,
      // React might try to re-render the erroring component again.
      // A simple message can be a safe bet.
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#333', background: '#f0f0f0', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <h1>Application Error</h1>
          <p>An error occurred in the animated theme. Attempting to switch to classic view.</p>
          <p>If the issue persists, please refresh the page.</p>
          {this.state.error && <pre style={{ marginTop: '10px', whiteSpace: 'pre-wrap', background: '#ddd', padding: '10px', borderRadius: '4px', maxWidth: '600px', overflowX: 'auto' }}>{this.state.error.toString()}</pre>}
        </div>
      );
    }

    return this.props.children;
  }
}

export default AnimatedThemeErrorBoundary;
