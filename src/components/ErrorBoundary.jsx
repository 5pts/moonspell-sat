import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Moonspell render error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="error-page">
        <section className="error-panel" role="alert">
          <p className="page-kicker">Application error</p>
          <h1>这个页面没有正常打开</h1>
          <p>你的本机学习数据没有被删除。刷新页面重试；如果问题持续存在，可以展开技术信息。</p>
          <details>
            <summary>技术信息</summary>
            <pre>{String(error)}{errorInfo?.componentStack || ''}</pre>
          </details>
          <button type="button" className="primary-action" onClick={() => window.location.assign(import.meta.env.BASE_URL)}>
            返回首页
          </button>
        </section>
      </main>
    );
  }
}
