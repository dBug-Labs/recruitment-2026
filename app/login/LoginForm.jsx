"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn grad"
      disabled={pending}
      style={{ width: "100%", justifyContent: "center", padding: "13px 0", fontSize: 16, marginTop: 6 }}
    >
      {pending ? "Signing in…" : "Sign In"}
    </button>
  );
}

export default function CandidateLoginForm({ action }) {
  const [state, formAction] = useActionState(action, {});

  return (
    <>
      {state?.error && <div className="alert err">⚠ {state.error}</div>}
      <form action={formAction} className="authForm">
        <div>
          <label htmlFor="candidate-email">SRM Email or Registration Number</label>
          <input
            id="candidate-email"
            className="input"
            type="text"
            name="email"
            autoComplete="username"
            required
            placeholder="xx1234@srmist.edu.in"
          />
        </div>
        <div>
          <label htmlFor="candidate-password">Password</label>
          <input
            id="candidate-password"
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="from your confirmation email"
          />
        </div>
        <SubmitButton />
      </form>
    </>
  );
}
