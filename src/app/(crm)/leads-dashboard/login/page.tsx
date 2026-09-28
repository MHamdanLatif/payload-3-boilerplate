import { LoginForm } from '@/components/crm/LoginForm'
export default function LoginPage() {
  return (
    <main className="crm-wrap" style={{ maxWidth: 480 }}>
      <div className="py-8">
        <p className="crm-eyebrow">Your conversations, in one place</p>
        <h1 className="crm-title">Welcome back.</h1>
        <p className="crm-muted mt-3">Sign in with your existing Lateef account.</p>
      </div>
      <LoginForm />
    </main>
  )
}
