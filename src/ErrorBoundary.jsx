import { Component } from "react";

// Last line of defence: a render crash shows a way back instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Render crash:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page-shell crash-page">
        <span className="empty-mark">✦</span>
        <h1>Něco se pokazilo</h1>
        <p>Stránku se nepodařilo zobrazit. Obnovte ji prosím, váš košík zůstane uložený.</p>
        <div className="crash-actions">
          <button className="primary-button" onClick={() => window.location.reload()}>
            Obnovit stránku <span>→</span>
          </button>
          <button className="checkout-secondary" onClick={() => window.location.assign("/")}>
            Zpět do obchodu
          </button>
        </div>
      </main>
    );
  }
}
