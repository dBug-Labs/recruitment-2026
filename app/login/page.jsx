import { signIn } from "@/lib/auth";

export const metadata = {
  title: "Login | dBug Labs",
};

export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="formCard" style={{ maxWidth: 420, width: "100%", textAlign: "center", padding: "40px 32px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🕷</div>
        <h3 className="cardTitle" style={{ fontSize: 24, margin: "0 0 12px", color: "var(--pink)" }}>
          PORTAL LOGIN
        </h3>
        <p style={{ color: "#a99bad", fontSize: 15, marginBottom: 32, lineHeight: 1.5 }}>
          Enter your SRM Email or Registration Number and password to continue. For Admin access, leave Email blank.
        </p>

        <form action={async (formData) => {
          "use server";
          const email = formData.get("email")?.toString().trim();
          const password = formData.get("password")?.toString();
          
          await signIn("credentials", { 
            email: email || undefined, 
            password, 
            redirectTo: email ? "/dashboard" : "/admin" 
          });
        }} style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "left" }}>
          
          <input 
            type="text" 
            name="email" 
            placeholder="SRM Email or Reg No (Leave blank for Admin)" 
            style={{ padding: "14px", borderRadius: "8px", border: "1px solid #2a1f2e", background: "#150b1a", color: "#fff", fontSize: 15, outline: "none" }}
          />

          <input 
            type="password" 
            name="password" 
            placeholder="Password" 
            required
            style={{ padding: "14px", borderRadius: "8px", border: "1px solid #2a1f2e", background: "#150b1a", color: "#fff", fontSize: 15, outline: "none" }}
          />

          <button type="submit" className="btn grad" style={{ width: "100%", padding: "14px 0", fontSize: 16, marginTop: "8px", cursor: "pointer" }}>
            Sign In
          </button>
        </form>

      </div>
    </main>
  );
}
