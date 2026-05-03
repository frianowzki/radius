"use client";

import React from "react";
import Link from "next/link";
import { logToServer } from "@/lib/log-client";

interface Props { children: React.ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logToServer({
      message: error.message,
      stack: error.stack,
      context: { componentStack: info.componentStack ?? undefined },
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="phone-shell">
        <div className="screen-pad pt-24 text-center">
          <div className="orb mx-auto mb-6 h-20 w-20 rounded-full" />
          <h1 className="text-2xl font-semibold tracking-[-0.04em]">Something broke</h1>
          <p className="mx-auto mt-3 max-w-72 text-sm leading-6 text-[#8b8795]">
            We logged this error so we can fix it. Try refreshing or going home.
          </p>
          <p className="mx-auto mt-3 max-w-72 break-words text-[11px] text-[#a09baa]">{process.env.NODE_ENV === "production" ? "An unexpected error occurred." : this.state.error.message}</p>
          <div className="mx-auto mt-6 grid max-w-64 grid-cols-2 gap-3">
            <button type="button" onClick={this.reset} className="ghost-btn py-3 text-xs">Try again</button>
            <Link href="/" className="primary-btn py-3 text-center text-xs">Go home</Link>
          </div>
        </div>
      </div>
    );
  }
}
