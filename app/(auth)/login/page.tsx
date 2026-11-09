import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 gap-5 bg-background md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 shadow-lg md:block">
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 right-0 size-[28rem] rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-end gap-3 p-10 text-white">
          <span className="text-sm font-medium uppercase tracking-widest opacity-80">
            Spurs Admin
          </span>
          <h1 className="text-4xl font-semibold leading-tight">
            One panel.
            <br />
            Every Spurs subdomain.
          </h1>
          <p className="max-w-sm text-base opacity-90">
            Sign in to manage users, settings and every app from a single place.
          </p>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-lg flex-col justify-center px-6 py-10">
        <LoginForm />
      </div>
    </main>
  );
}
