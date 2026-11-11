import * as React from 'react';
import { reportClientDiagnostic } from './client-diagnostics';

type State = { failed: boolean; reference: string | null };
export class DiagnosticBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false, reference: null };
  static getDerivedStateFromError(): Partial<State> { return { failed: true }; }
  componentDidCatch(): void { this.setState({ reference: reportClientDiagnostic('render') }); }
  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    return <main dir="rtl" role="alert" style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>نمایش برنامه با خطا مواجه شد</h1>
      <p>صفحه را دوباره بارگذاری کنید. در صورت تکرار، شناسه زیر را به پشتیبانی بدهید.</p>
      {this.state.reference && <p>شناسه خطا: <bdi>{this.state.reference}</bdi></p>}
      <button type="button" onClick={() => window.location.reload()}>بارگذاری دوباره</button>
    </main>;
  }
}
