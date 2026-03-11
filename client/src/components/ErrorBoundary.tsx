import { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'motion/react';
import { GradientText } from '@/components/reactbits';
import { RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div role="alert" aria-live="assertive" className="min-h-screen flex items-center justify-center px-4 bg-background">
          <div className="text-center max-w-md">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <GradientText
                colors={['#ef4444', '#f97316', '#eab308', '#ef4444']}
                animationSpeed={3}
                className="text-7xl font-bold mb-4"
              >
                500
              </GradientText>
            </motion.div>
            <motion.h2
              className="text-2xl font-semibold mb-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Something went wrong
            </motion.h2>
            <motion.p
              className="text-muted-foreground mb-6 text-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              An unexpected error occurred. Please try again.
            </motion.p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <motion.pre
                className="text-xs text-left bg-destructive/10 text-destructive p-3 rounded-lg mb-6 overflow-auto max-h-32"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {this.state.error.message}
              </motion.pre>
            )}
            <motion.div
              className="flex gap-3 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
              >
                <RefreshCw className="h-4 w-4" /> Try Again
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 border rounded-lg text-sm font-medium hover:bg-accent"
              >
                <Home className="h-4 w-4" /> Go Home
              </motion.a>
            </motion.div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
