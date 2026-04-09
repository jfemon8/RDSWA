import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SEO from '@/components/SEO';
import ErrorBoundary from '@/components/ErrorBoundary';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

// Wrap components with necessary providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

describe('SEO Component', () => {
  it('should render without crashing', () => {
    render(
      <TestWrapper>
        <SEO title="Test Page" description="A test page" />
      </TestWrapper>
    );
    // SEO renders in <head>, so we check document.title
    expect(document.title).toBe('Test Page | RDSWA');
  });

  it('should use default site name when no title provided', () => {
    render(
      <TestWrapper>
        <SEO />
      </TestWrapper>
    );
    expect(document.title).toBe('RDSWA');
  });
});

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <TestWrapper>
        <ErrorBoundary>
          <div>Hello World</div>
        </ErrorBoundary>
      </TestWrapper>
    );
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should catch errors and render error UI', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function ThrowError(): never {
      throw new Error('Test error');
    }

    render(
      <TestWrapper>
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      </TestWrapper>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go Home')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('should render custom fallback when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function ThrowError(): never {
      throw new Error('Test error');
    }

    render(
      <TestWrapper>
        <ErrorBoundary fallback={<div>Custom Error</div>}>
          <ThrowError />
        </ErrorBoundary>
      </TestWrapper>
    );

    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
